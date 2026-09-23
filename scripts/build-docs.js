#!/usr/bin/env bun
/**
 * scripts/build-docs.js — regenerate the published `docs/demistify/` tutorial site.
 *
 * Implementation of plan/improvement-plan.md P4-1 (stale hand-committed Vite build) and
 * P4-2 (tutorial markdown had 4 unsynchronised copies).
 *
 * There is no CI (plan §0, D1/D2): this script is run by hand — `bun run docs:build` — and its
 * output is committed. It is therefore written to be *deterministic*: rebuilding unchanged
 * sources must produce byte-identical files, so a diff in `docs/demistify/` always means a real
 * change (or drift caught by `scripts/check-docs.js`).
 *
 * What it does:
 *   1. bundles `apps/repl/src/demistify.jsx` with the **same** pipeline the REPL build uses: it
 *      imports `esbDef` from `apps/repl/src_build/buildScript.js` (the canonical definition used
 *      by `apps/repl/src_build/build.js`) instead of defining a parallel build;
 *   2. copies the tutorial markdown and `jsx2dom.js` from `apps/repl/static/` — the single source
 *      of truth decided in P4-2;
 *   3. renders `docs/demistify/index.html` from `apps/repl/static/demistify.jsx.online.html` (the
 *      CDN variant of the page) with the Monaco/Babel versions this repo actually builds and with
 *      the asset names esbuild actually emits (no stale hashes, working favicon);
 *   4. validates the staged output — every local `src`/`href`/`url()` resolves on disk and the
 *      generated JS parses — and only then replaces `docs/demistify/`, so a failed build can
 *      never leave a half-written published artifact behind.
 *
 * Sandbox note: esbuild's JS API talks to a long-lived native service over pipes, which the local
 * file sandbox denies (EPERM on spawn). The esbuild **CLI** with inherited stdio works, so the
 * bundle is produced by the CLI driven from `esbDef` — same binary and same options.
 *
 * Usage:
 *   bun run docs:build              regenerate docs/demistify/
 *   bun run scripts/build-docs.js --stage   build + validate into .tmp, leave docs/ untouched
 */
import { spawnSync } from 'child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { dirname, join, relative, resolve, sep } from 'path'

export const ROOT = resolve(import.meta.dir, '..')
export const REPL_DIR = join(ROOT, 'apps/repl')
export const STATIC_DIR = join(REPL_DIR, 'static')
export const DOCS_DIR = join(ROOT, 'docs/demistify')
export const STAGE_DIR = join(ROOT, '.tmp/docs-demistify-build')

/** Page template: the CDN variant of the tutorial page lives next to the local one in static/. */
const TEMPLATE = 'demistify.jsx.online.html'
/** Files copied verbatim from apps/repl/static/ (markdown = P4-2 source of truth). */
export const STATIC_FILES = ['demistify.jsx.md', 'jsx2dom.js']
const ASSET_DIR = 'assets'

/**
 * Production-flavoured options layered on top of the shared `esbDef`: the REPL dev/prod builds
 * ship unminified bundles for debuggability, but this directory is a *published* artifact, so it
 * is minified (like the Vite build it replaces). Source maps are off by default — the maps in the
 * committed directory were ~420 KB that no longer matched any shipped source layout; pass `--map`
 * when debugging the deployed page locally.
 */
const DOCS_BUILD_OPTIONS = { minify: true, sourcemap: process.argv.includes('--map') }

// ---------------------------------------------------------------------------------------------
// versions: always derived from what this repo builds, never hand-pinned (P4-1)
// ---------------------------------------------------------------------------------------------

const replRequire = createRequire(join(REPL_DIR, 'package.json'))

function installedVersion(name) {
  const pkgPath = replRequire.resolve(`${name}/package.json`)
  return JSON.parse(readFileSync(pkgPath, 'utf8')).version
}

/**
 * Monaco is loaded from a CDN at runtime, so the pinned URL has to match the version this
 * monorepo actually builds (`libs/editor-monaco`). Previously this was hard-coded as 0.34.100
 * while the repo was at 0.48.0 — the stale pin this work item fixes.
 * Babel standalone is pinned to the version `apps/repl` copies into its own build output.
 *
 * Resolved lazily (and memoised) so that importing this module — `check-docs.js` does — has no
 * side effects and does not require node_modules for the markdown/HTML checks.
 */
let versions
export function cdnVersions() {
  if (!versions) {
    versions = {
      monaco: installedVersion('@jsx6/editor-monaco'),
      babel: installedVersion('@babel/standalone'),
    }
  }
  return versions
}

/** Deterministic favicon; the old page referenced a Vite scaffold file (`/vite.svg`) that is not
 * in this repo, so the published page had a 404 icon. */
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#2b3a55"/>
  <text x="32" y="43" text-anchor="middle" font-family="system-ui, sans-serif"
        font-size="30" font-weight="700" fill="#7fd1ff">JSX</text>
</svg>
`

// ---------------------------------------------------------------------------------------------
// index.html
// ---------------------------------------------------------------------------------------------

function replaceOnce(text, pattern, replacement, what) {
  const matches = text.match(pattern)
  if (!matches) throw new Error(`template no longer contains ${what} (${pattern}) — refusing to guess`)
  return text.replace(pattern, replacement)
}

/**
 * Render the published page from the static template. Pure function of the template + the
 * versions passed in, so `scripts/check-docs.js` can diff it without running a build.
 *
 * @param {object} [opts]
 * @param {string} [opts.template] raw template html (defaults to the committed static file)
 * @param {string} [opts.monacoVersion]
 * @param {string} [opts.babelVersion]
 * @returns {string}
 */
export function renderIndexHtml(opts = {}) {
  const template = opts.template ?? readFileSync(join(STATIC_DIR, TEMPLATE), 'utf8')
  const monaco = opts.monacoVersion ?? cdnVersions().monaco
  const babel = opts.babelVersion ?? cdnVersions().babel

  let html = template.replace(/@jsx6\/editor-monaco@[\d.]+/g, `@jsx6/editor-monaco@${monaco}`)
  if (!html.includes(`@jsx6/editor-monaco@${monaco}`)) {
    throw new Error('template does not reference @jsx6/editor-monaco — refusing to guess')
  }
  html = html.replace(/@babel\/standalone@[\d.]+/g, `@babel/standalone@${babel}`)
  if (!html.includes(`@babel/standalone@${babel}`)) {
    throw new Error('template does not reference @babel/standalone — refusing to guess')
  }
  // favicon: relative, and the file is generated into this directory by buildStage()
  html = replaceOnce(html, /(<link rel="icon"[^>]*href=")[^"]*(")/, '$1./favicon.svg$2', 'the icon link')
  // asset names: relative paths (the site is served from a sub-path, e.g. /jsx6/demistify/) and
  // the names esbuild actually emits, replacing the Vite hash names and the `/demistify.js` root
  // absolute path of the template.
  html = replaceOnce(
    html,
    /<script type="module" src="[^"]*demistify\.js"><\/script>/,
    `<script type="module" crossorigin src="./${ASSET_DIR}/demistify.js"></script>\n` +
      `    <link rel="stylesheet" href="./${ASSET_DIR}/demistify.css" />`,
    'the demistify module script tag',
  )
  return html
}

// ---------------------------------------------------------------------------------------------
// the esbuild CLI invocation, driven from the repl pipeline definition
// ---------------------------------------------------------------------------------------------

/** Map the JS-API options object of `buildScript.js` onto esbuild CLI flags. */
function esbDefToCliArgs(esbDef, { entry, outdir }) {
  const args = [entry, `--outdir=${outdir}`, `--log-level=warning`]
  if (esbDef.bundle) args.push('--bundle')
  if (esbDef.format) args.push(`--format=${esbDef.format}`)
  if (esbDef.jsx) args.push(`--jsx=${esbDef.jsx}`)
  if (esbDef.jsxImportSource) args.push(`--jsx-import-source=${esbDef.jsxImportSource}`)
  if (esbDef.tsconfig) args.push(`--tsconfig=${resolve(REPL_DIR, esbDef.tsconfig)}`)
  for (const [ext, loader] of Object.entries(esbDef.loader ?? {})) {
    args.push(`--loader:${ext}=${loader}`)
  }
  if (DOCS_BUILD_OPTIONS.minify) args.push('--minify')
  // JS API `sourcemap: true` is the CLI's bare `--sourcemap` (= "linked"); other modes map 1:1.
  if (DOCS_BUILD_OPTIONS.sourcemap === true) args.push('--sourcemap')
  else if (DOCS_BUILD_OPTIONS.sourcemap) args.push(`--sourcemap=${DOCS_BUILD_OPTIONS.sourcemap}`)
  return args
}

function esbuildBin() {
  const pkg = JSON.parse(readFileSync(replRequire.resolve('esbuild/package.json'), 'utf8'))
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.esbuild
  if (!bin) throw new Error('esbuild package.json has no bin entry — run: bun install')
  return join(dirname(replRequire.resolve('esbuild/package.json')), bin)
}

function runEsbuildCli(args) {
  // stdio: 'inherit' — see the sandbox note at the top of this file.
  const res = spawnSync(process.execPath, [esbuildBin(), ...args], {
    cwd: REPL_DIR,
    stdio: 'inherit',
  })
  if (res.error) throw new Error(`could not start esbuild: ${res.error.message}`)
  if (res.status !== 0) throw new Error(`esbuild exited with code ${res.status}`)
}

// ---------------------------------------------------------------------------------------------
// staging
// ---------------------------------------------------------------------------------------------

/**
 * Build the complete tutorial site into `dir`. Returns the list of files written.
 * @param {string} dir
 */
export async function buildStage(dir) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(join(dir, ASSET_DIR), { recursive: true })

  const { esbDef } = await import(join(REPL_DIR, 'src_build/buildScript.js'))
  runEsbuildCli(esbDefToCliArgs(esbDef, { entry: './src/demistify.jsx', outdir: join(dir, ASSET_DIR) }))

  for (const file of STATIC_FILES) {
    cpSync(join(STATIC_DIR, file), join(dir, file))
  }
  writeFileSync(join(dir, 'favicon.svg'), FAVICON_SVG)
  writeFileSync(join(dir, 'index.html'), renderIndexHtml())

  return listFiles(dir)
}

export function listFiles(dir) {
  const out = []
  const walk = current => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else out.push(relative(dir, full).split(sep).join('/'))
    }
  }
  walk(dir)
  return out
}

export function dirSize(dir) {
  return listFiles(dir).reduce((sum, rel) => sum + statSync(join(dir, rel)).size, 0)
}

// ---------------------------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------------------------

const EXTERNAL = /^(https?:)?\/\//i
const IGNORED_REF = /^(data:|mailto:|#|javascript:)/i

/**
 * Every local `src`/`href`/`url()` reference in a text file, with the path it resolves to.
 * Absolute (protocol-relative/http/data) references are returned as `{ external: true }`.
 */
export function extractRefs(file, baseDir) {
  const text = readFileSync(file, 'utf8')
  const refs = []
  const add = url => {
    if (EXTERNAL.test(url) || IGNORED_REF.test(url)) refs.push({ url, external: true })
    else {
      const clean = url.split(/[?#]/)[0]
      refs.push({
        url,
        external: false,
        rootAbsolute: clean.startsWith('/'),
        resolved: resolve(baseDir, clean.replace(/^\//, '')),
      })
    }
  }
  for (const m of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) add(m[1])
  for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) add(m[1])
  return refs
}

/** Assert every local reference inside the staged site resolves to a file on disk. */
export function validateRefs(dir) {
  const errors = []
  const missing = []
  const external = []
  for (const file of listFiles(dir)) {
    if (!/\.(html|css)$/.test(file)) continue
    const base = dirname(join(dir, file))
    for (const ref of extractRefs(join(dir, file), base)) {
      if (ref.external) {
        external.push(`${file} -> ${ref.url}`)
        continue
      }
      if (ref.rootAbsolute) {
        // docs/demistify is published under a sub-path (github pages /jsx6/demistify/), so a
        // root-absolute local URL (the old `/vite.svg`) is a 404 waiting to happen.
        errors.push(`${file}: root-absolute local reference is not portable: ${ref.url}`)
        continue
      }
      if (!existsSync(ref.resolved)) {
        missing.push(`${file}: ${ref.url}`)
        errors.push(`${file}: ${ref.url} does not resolve to a file on disk`)
      }
    }
  }
  return { errors, missing, external }
}

/**
 * Every asset in `assets/` must be referenced by the page (or be a source map referenced from
 * one of the generated files). Catches the orphaned hashed Vite chunks this directory used to
 * accumulate: stale asset naming is the P4-1 defect.
 */
export function validateNoOrphanAssets(dir) {
  const errors = []
  const page = readFileSync(join(dir, 'index.html'), 'utf8')
  for (const file of listFiles(join(dir, ASSET_DIR))) {
    if (file.endsWith('.map')) continue // referenced through sourceMappingURL
    const name = file.split('/').pop()
    if (!page.includes(name)) errors.push(`assets/${file} is not referenced by index.html`)
  }
  return errors
}

/**
 * Parse every generated `.js` with Bun (`--no-bundle`, i.e. transpile-only). One `--outfile` per
 * file: `--outdir` currently fails under Bun 1.3 with `EEXIST: failed to write file '""'`.
 */
export function syntaxCheck(files, workDir) {
  const errors = []
  const js = files.filter(f => f.endsWith('.js'))
  if (!js.length) return ['no generated .js files to syntax-check']
  rmSync(workDir, { recursive: true, force: true })
  mkdirSync(workDir, { recursive: true })
  for (const file of js) {
    const res = spawnSync(
      process.execPath,
      ['build', '--no-bundle', '--target=browser', file, `--outfile=${join(workDir, 'checked.js')}`],
      { stdio: 'inherit' },
    )
    if (res.error) errors.push(`could not start bun: ${res.error.message}`)
    else if (res.status !== 0) errors.push(`syntax check failed for ${file} (exit ${res.status})`)
  }
  rmSync(workDir, { recursive: true, force: true })
  return errors
}

/**
 * Validate a staged site. Returns `{ errors, external }`.
 * @param {string} dir
 * @param {{ syntax?: boolean }} [opts]
 */
export function validateStage(dir, opts = {}) {
  const errors = []
  if (!existsSync(join(dir, 'index.html'))) errors.push('index.html was not generated')
  if (!existsSync(join(dir, 'demistify.jsx.md'))) errors.push('tutorial markdown was not copied')
  const refs = validateRefs(dir)
  errors.push(...refs.errors, ...validateNoOrphanAssets(dir))
  if (opts.syntax !== false) {
    errors.push(
      ...syntaxCheck(
        listFiles(join(dir, ASSET_DIR)).map(f => join(dir, ASSET_DIR, f)),
        join(STAGE_DIR, '.syntax'),
      ),
    )
  }
  return { errors, external: refs.external }
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------

async function main() {
  const stageOnly = process.argv.includes('--stage')
  const before = existsSync(DOCS_DIR) ? dirSize(DOCS_DIR) : 0

  console.log(`docs:build — monaco CDN ${cdnVersions().monaco}, babel CDN ${cdnVersions().babel}`)
  console.log(`staging into ${relative(ROOT, STAGE_DIR)}`)
  await buildStage(STAGE_DIR)

  const { errors, external } = validateStage(STAGE_DIR)
  const files = listFiles(STAGE_DIR)
  for (const file of files) {
    console.log(`  ${file.padEnd(28)} ${String(statSync(join(STAGE_DIR, file)).size).padStart(8)} B`)
  }
  console.log(`external references (intentional CDN): ${external.length}`)
  for (const e of external) console.log(`  ${e}`)
  if (errors.length) {
    for (const e of errors) console.error(`[error] ${e}`)
    console.error(`\nvalidation failed — docs/demistify/ was NOT modified (staged output: ${STAGE_DIR})`)
    process.exit(1)
  }

  if (stageOnly) {
    console.log('\n--stage: skip publishing, docs/demistify/ untouched')
    return
  }

  rmSync(DOCS_DIR, { recursive: true, force: true })
  mkdirSync(dirname(DOCS_DIR), { recursive: true })
  cpSync(STAGE_DIR, DOCS_DIR, { recursive: true })
  rmSync(join(DOCS_DIR, '.syntax'), { recursive: true, force: true })

  const after = dirSize(DOCS_DIR)
  console.log(`\ndocs/demistify/: ${before} B -> ${after} B`)
  console.log('BUILD SUCCESS')
}

if (import.meta.main) await main()
