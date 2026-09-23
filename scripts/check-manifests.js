/**
 * Package manifest audit — implementation of plan/improvement-plan.md §2.3.
 *
 * There is no CI in this project (D1), so this local check is the only thing standing between
 * a broken manifest and a broken published tarball. It catches the three breakages that already
 * shipped (`@jsx6/jsx6` without `dist/`, `@jsx6/nodditor` without `cjs/`, `@jsx6/repl` without
 * `index.js`) plus the `minimatch`-in-devDependencies class of bug.
 *
 * Checks, per non-private package:
 *   1. every path in exports/main/module/unpkg/types exists on disk, or is produced by that
 *      package's own build/build-cjs/tsc script;
 *   2. every directory those paths live in is covered by `files`;
 *   3. every bare import in index.js + src/** resolves to a runtime dependency;
 *   4. `version` agrees with MODULE_VERSIONING.md and, where present, jsr.json;
 *   5. the dry-run tarball listing (`npm pack --dry-run --json`) actually contains the declared
 *      entry points (and `dist/` when it is declared as the types location).
 *
 * Run standalone with `bun run scripts/check-manifests.js`, or as part of `bun run check`.
 */
import { spawnSync } from 'child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync } from 'fs'
import { Glob } from 'bun'
import { join, resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const TMP = join(ROOT, '.tmp')

/** Directories inside a package that hold generated output, never hand-written source. */
const GENERATED_DIRS = new Set(['node_modules', 'dist', 'esm', 'cjs', 'build', 'build_dev', 'coverage'])

const BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants', 'crypto',
  'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https',
  'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring',
  'readline', 'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events', 'tty',
  'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib', 'bun', 'test',
])

/** Strip // and /* *\/ comments so JSONC (tsconfig.json) can be parsed. */
function parseJsonc(text) {
  return JSON.parse(
    text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:"'\\])\/\/.*$/gm, '$1')
      .replace(/,(\s*[}\]])/g, '$1'),
  )
}

function packageDirs() {
  const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const dirs = []
  for (const ws of rootPkg.workspaces || []) {
    const [base, pattern] = ws.split('/')
    if (pattern === '*') {
      for (const entry of readdirSync(join(ROOT, base), { withFileTypes: true })) {
        if (entry.isDirectory()) dirs.push(`${base}/${entry.name}`)
      }
    } else {
      dirs.push(ws)
    }
  }
  return dirs.filter(dir => existsSync(join(ROOT, dir, 'package.json')))
}

/** All string paths a manifest points consumers at. */
function declaredPaths(pkg) {
  const paths = new Set()
  const add = value => {
    if (typeof value === 'string') paths.add(value.replace(/^\.\//, ''))
    else if (value && typeof value === 'object') for (const v of Object.values(value)) add(v)
  }
  add(pkg.exports)
  add(pkg.main)
  add(pkg.module)
  add(pkg.unpkg)
  add(pkg.types)
  add(pkg.typings)
  return [...paths]
}

function readTsconfigOutDir(dir) {
  const file = join(ROOT, dir, 'tsconfig.json')
  if (!existsSync(file)) return null
  try {
    const cfg = parseJsonc(readFileSync(file, 'utf8'))
    const out = cfg.compilerOptions?.outDir
    return typeof out === 'string' ? out.replace(/^\.\//, '') : null
  } catch {
    return null
  }
}

/** Output roots this package's own scripts are able to produce. */
function buildOutputs(pkg, dir) {
  const outs = new Set()
  for (const [name, cmd] of Object.entries(pkg.scripts || {})) {
    if (typeof cmd !== 'string') continue
    if (!name.startsWith('build') && name !== 'tsc') continue
    for (const m of cmd.matchAll(/--out(?:dir|file|base)[= ]([^\s"']+)/g)) {
      outs.add(m[1].replace(/^\.\//, ''))
    }
    if (name === 'tsc' || /(^|\s)tsc(\s|$)/.test(cmd)) {
      const outDir = readTsconfigOutDir(dir)
      if (outDir) outs.add(outDir)
    }
  }
  return outs
}

/** Is `path` inside `files`, or covered by one of its directory entries? */
function coveredByFiles(path, files) {
  if (!files) return true // no `files` field: npm includes everything
  return files.some(entry => {
    const e = entry.replace(/^\.\//, '').replace(/\/$/, '')
    return path === e || path.startsWith(e + '/')
  })
}

/** Remove comments so commented-out imports and JSDoc usage examples are not reported. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1')
}

/** Bare module specifiers imported by a file (static import, `from`, require, dynamic import). */
function bareImports(rawSource) {
  const found = new Set()
  const source = stripComments(rawSource)
  const patterns = [
    // `import ... from 'x'` / `export ... from 'x'`: anchored at a statement boundary and not
    // allowed to cross quotes or semicolons, so prose like "copying from ' to '" cannot match.
    /(?:^|[\n;}])\s*(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /(?:^|[\n;}])\s*import\s+['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const re of patterns) {
    for (const m of source.matchAll(re)) {
      const spec = m[1]
      if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) continue
      const parts = spec.split('/')
      const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
      if (name && !BUILTINS.has(name)) found.add(name)
    }
  }
  return found
}

function sourceFiles(dir) {
  const out = []
  const candidates = ['index.js', 'index.jsx']
  for (const c of candidates) if (existsSync(join(ROOT, dir, c))) out.push(`${dir}/${c}`)
  for (const pattern of ['src/**/*.js', 'src/**/*.jsx']) {
    for (const rel of new Glob(pattern).scanSync({ cwd: join(ROOT, dir), onlyFiles: true })) {
      // Filter on the path *inside* the package: a package may itself be named `build`/`dist`.
      const inner = rel.replaceAll('\\', '/')
      if (/\.test\.(js|jsx)$/.test(inner)) continue
      if (inner.split('/').some(s => GENERATED_DIRS.has(s))) continue
      out.push(`${dir}/${inner}`)
    }
  }
  return out
}

/** Dry-run tarball listing. Captured through a file because piped child stdio is not always available. */
function tarballFiles(dir) {
  mkdirSync(TMP, { recursive: true })
  const out = join(TMP, `pack-${dir.replace(/[\\/]/g, '_')}.json`)
  const errFile = join(TMP, `pack-${dir.replace(/[\\/]/g, '_')}.err`)
  const fd = openSync(out, 'w')
  // npm's stderr goes to a file too: on some Windows setups npm prints an unrelated
  // "npm-prefix.js is not recognized" line on every invocation, which would otherwise drown the
  // audit output. Real failures are still reported if the listing cannot be parsed.
  const errFd = openSync(errFile, 'w')
  const res = spawnSync('npm pack --dry-run --json', {
    cwd: join(ROOT, dir),
    shell: true,
    stdio: ['ignore', fd, errFd],
    env: { ...process.env, npm_config_cache: join(TMP, 'npm-cache'), npm_config_loglevel: 'error' },
  })
  closeSync(fd)
  closeSync(errFd)
  let stderr = ''
  try {
    stderr = readFileSync(errFile, 'utf8').trim().split('\n').slice(-1)[0] || ''
  } catch {
    /* ignore */
  }
  try {
    const parsed = JSON.parse(readFileSync(out, 'utf8'))
    const files = parsed?.[0]?.files?.map(f => f.path.replace(/^package\//, '')) || []
    return { files, status: res.status, error: stderr }
  } catch (err) {
    return { files: null, status: res.status, error: stderr || err.message }
  } finally {
    rmSync(out, { force: true })
    rmSync(errFile, { force: true })
  }
}

function parseVersioningDoc() {
  const text = readFileSync(join(ROOT, 'MODULE_VERSIONING.md'), 'utf8')
  const lockstepVersion = /\*\*Lockstep[^*]*Current Version:\s*\*\*([^*]+)\*\*/.exec(text)?.[1]?.trim()
    || /Current Version:\s*\*\*([^*]+)\*\*/.exec(text)?.[1]?.trim()
  const listed = new Set()
  for (const m of text.matchAll(/^-\s+`([^`]+)`/gm)) listed.add(m[1])
  const lockstep = new Set()
  const lockstepSection = text.split('## Standalone Modules')[0]
  for (const m of lockstepSection.matchAll(/^-\s+`([^`]+)`/gm)) lockstep.add(m[1])
  return { lockstepVersion, listed, lockstep }
}

/**
 * True when consumers import this package's raw source (so every import it makes must be a
 * runtime dependency). Bundled packages resolve their imports at build time instead, which is
 * why a build-time dependency in devDependencies is only a warning there.
 */
function shipsRawSource(pkg) {
  const entry = String(pkg.exports?.['.']?.default || pkg.main || '').replace(/^\.\//, '')
  return /\.(js|jsx)$/.test(entry) && !/^(dist|esm|cjs|build)\//.test(entry)
}

/**
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function auditManifests({ pack = true, requireBuilt = false } = {}) {
  const errors = []
  const warnings = []
  const versioning = parseVersioningDoc()
  const dirs = packageDirs()

  for (const dir of dirs) {
    const pkg = JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8'))
    const label = pkg.name || dir
    if (pkg.private) continue

    const files = pkg.files
    const outputs = buildOutputs(pkg, dir)
    const declared = declaredPaths(pkg)

    // 1 + 2 — declared paths exist (or are built), and live in a directory that ships.
    for (const path of declared) {
      if (path.includes('*')) continue // wildcard subpath export patterns
      const onDisk = existsSync(join(ROOT, dir, path))
      const top = path.split('/')[0]
      const produced = outputs.has(top) || [...outputs].some(o => path.startsWith(o.replace(/^\.\//, '') + '/'))
      if (!onDisk && !produced) {
        errors.push(`${label}: declares "${path}" but it is neither on disk nor produced by a build script`)
      }
      if (!coveredByFiles(path, files)) {
        errors.push(`${label}: "${path}" is not covered by "files" (${JSON.stringify(files)})`)
      }
    }

    // 3 — every bare import resolves to a runtime dependency.
    const runtime = new Set([
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
      ...Object.keys(pkg.optionalDependencies || {}),
    ])
    const dev = new Set(Object.keys(pkg.devDependencies || {}))
    const rawSource = shipsRawSource(pkg)
    for (const file of sourceFiles(dir)) {
      let source
      try {
        source = readFileSync(join(ROOT, file), 'utf8')
      } catch {
        continue
      }
      for (const name of bareImports(source)) {
        // Workspace-internal packages are declared as dependencies like any other.
        if (runtime.has(name)) continue
        if (dev.has(name) && rawSource) {
          errors.push(`${label}: ${file} imports "${name}", which is only in devDependencies but this package ships raw source`)
        } else if (dev.has(name)) {
          warnings.push(`${label}: ${file} imports build-time dependency "${name}" from devDependencies`)
        } else {
          warnings.push(`${label}: ${file} imports "${name}", which is not declared at all`)
        }
      }
    }

    // 4 — versions agree with the versioning doc and jsr.json.
    if (!versioning.listed.has(pkg.name)) {
      errors.push(`${label}: missing from MODULE_VERSIONING.md`)
    }
    if (versioning.lockstep.has(pkg.name) && versioning.lockstepVersion && pkg.version !== versioning.lockstepVersion) {
      errors.push(`${label}: version ${pkg.version} != lockstep version ${versioning.lockstepVersion}`)
    }
    const jsrPath = join(ROOT, dir, 'jsr.json')
    if (existsSync(jsrPath)) {
      const jsr = JSON.parse(readFileSync(jsrPath, 'utf8'))
      if (jsr.version !== pkg.version) {
        errors.push(`${label}: jsr.json version ${jsr.version} != package.json version ${pkg.version}`)
      }
    }

    // 5 — the tarball actually contains what consumers are told to import.
    if (pack) {
      const { files: packed, status, error } = tarballFiles(dir)
      if (!packed) {
        errors.push(`${label}: "npm pack --dry-run --json" produced no listing (status ${status}${error ? `: ${error}` : ''})`)
      } else {
        const inTarball = p =>
          packed.includes(p) || packed.some(f => f.startsWith(p.replace(/\/$/, '') + '/'))
        const fieldOf = new Map()
        for (const [kind, value] of [
          ['main', pkg.main],
          ['module', pkg.module],
          ['unpkg', pkg.unpkg],
          ['types', pkg.types || pkg.typings],
        ]) {
          const p = String(value || '').replace(/^\.\//, '')
          if (p) fieldOf.set(p, fieldOf.has(p) ? `${fieldOf.get(p)}/${kind}` : kind)
        }
        for (const raw of new Set([...declared, ...fieldOf.keys()])) {
          if (raw.includes('*')) continue
          const path = raw.replace(/^\.\//, '')
          const kind = fieldOf.get(path) || 'exports path'
          const onDisk = existsSync(join(ROOT, dir, path))
          const produced = outputs.has(path.split('/')[0])
          if (!onDisk && produced && !requireBuilt) {
            warnings.push(`${label}: ${kind} "${path}" is not built yet — run the package build before publishing`)
            continue
          }
          if (!inTarball(path)) errors.push(`${label}: ${kind} "${path}" is not in the tarball`)
        }
        const shippedTests = packed.filter(f => /\.test\.[a-z]+$/.test(f))
        if (shippedTests.length) {
          errors.push(`${label}: tarball ships test files (${shippedTests.slice(0, 3).join(', ')}${shippedTests.length > 3 ? ', …' : ''})`)
        }
      }
    }
  }

  return { errors, warnings }
}

if (import.meta.main) {
  const { errors, warnings } = auditManifests({
    pack: !process.argv.includes('--no-pack'),
    // Publishing must never ship a tarball with a declared-but-unbuilt entry point.
    requireBuilt: process.argv.includes('--require-built'),
  })
  for (const w of warnings) console.log(`[warn] ${w}`)
  for (const e of errors) console.error(`[error] ${e}`)
  if (errors.length) {
    console.error(`\nManifest audit failed with ${errors.length} error(s).`)
    process.exit(1)
  }
  console.log(`Manifest audit passed (${warnings.length} warning(s)).`)
}