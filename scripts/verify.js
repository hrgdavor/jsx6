#!/usr/bin/env bun
/**
 * Local verification gate — implementation of plan/improvement-plan.md §2.
 *
 * This project deliberately has no CI (D1). `bun run check` is the only gate there is, so it has
 * to be one command, reasonably fast, and must exit non-zero on any failure. `scripts/publish.js`
 * runs it before publishing for the same reason.
 *
 * Steps (in the order they run):
 *   1. `bun test` in every package that has tests (discovered, not hardcoded)
 *   2. the resolved TypeScript must be 7.x — `tsc` survives in this repo for exactly one job
 *      (declaration emit), and that job is written against TypeScript 7 behaviour
 *   3. `tsc -p tsconfig.json` per lib — declaration emit, the only `tsc` use left (`bun check`
 *      never writes files), keeps `dist/*.d.ts` producible, and runs first so dependents are
 *      checked against freshly emitted declarations
 *   4. `bun check` per lib — the JSDoc/`checkJs` type check, now Bun's built-in checker instead of
 *      `tsc --noEmit` (TypeScript 7 semantics, every core, never writes files). Catches the
 *      undefined-identifier bug class that shipped in P0-1…P0-3
 *   5. `--build` only: build each lib's esm/cjs bundles, so the tarball assertion is strict
 *   6. `oxlint` (includes the jsx6/signal-dependencies JS-plugin rule; `--deny-warnings` keeps
 *      warning-severity findings gate-stopping)
 *   7. `oxfmt --check` — every file in the tree is already canonically formatted (Oxfmt)
 *   8. `scripts/check-versions.js` — catalog hygiene
 *   9. `scripts/check-docs.js` — the committed docs site matches `apps/repl/static` (P4-2)
 *   10. `scripts/check-manifests.js` — manifest + dry-run tarball audit (§2.3)
 *   11. `scripts/check-workspace.js` — the single-package-manager invariant, and the guard rail that
 *      keeps Rush-era artifacts (and version drift between manifests) from creeping back
 *      (plan/rush/README.md R3/R4)
 *
 * Usage:
 *   bun run check                 full gate
 *   bun run check:fast            tests + `bun check` only
 *   bun run test                  tests only
 *   bun run check --build         as full gate, plus bundle builds and strict tarball assertions
 *   bun run scripts/verify.js --no-pack --no-lint    ad-hoc subsets
 */
import { spawnSync } from 'child_process'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { Glob } from 'bun'
import { join, resolve } from 'path'
import { auditManifests } from './check-manifests.js'
import { checkDocs } from './check-docs.js'

const ROOT = resolve(import.meta.dir, '..')
process.chdir(ROOT)

const argv = process.argv.slice(2)
const flag = name => argv.includes(`--${name}`)
const QUICK = flag('quick')
const TESTS_ONLY = flag('tests-only')

if (QUICK && TESTS_ONLY) {
  console.error('Use either --quick or --tests-only, not both.')
  process.exit(2)
}

const ALWAYS_IGNORED = new Set(['node_modules', '.history', '.tmp', '.git', 'coverage'])
/** Generated output inside a package: never contains hand-written tests. */
const GENERATED_DIRS = new Set(['dist', 'esm', 'cjs', 'build', 'build_dev', 'docs'])

function normalize(p) {
  return p.replaceAll('\\', '/')
}

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8'))
}

/** Workspace package directories, expanded from the root `workspaces` globs. */
function packageDirs() {
  const dirs = []
  for (const ws of readJson('package.json').workspaces || []) {
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

/** Test files grouped by the package that owns them. */
function testsByPackage() {
  const dirs = packageDirs()
  const owned = new Map()
  for (const ext of ['js', 'jsx', 'ts', 'tsx']) {
    for (const rel of new Glob(`**/*.test.${ext}`).scanSync({ onlyFiles: true })) {
      const path = normalize(rel)
      if (path.split('/').some(segment => ALWAYS_IGNORED.has(segment))) continue
      // Longest matching package dir wins, so a package named `build` (tools/build) is not
      // mistaken for generated output.
      const dir = dirs.filter(d => path.startsWith(d + '/')).sort((a, b) => b.length - a.length)[0]
      if (!dir) continue
      const inner = path.slice(dir.length + 1)
      if (inner.split('/').some(segment => GENERATED_DIRS.has(segment))) continue
      if (!owned.has(dir)) owned.set(dir, [])
      owned.get(dir).push(path)
    }
  }
  return owned
}

/** Libraries that type-check: anything under libs/ with a tsconfig.json. */
function libsWithTsconfig() {
  return packageDirs().filter(dir => dir.startsWith('libs/') && existsSync(join(ROOT, dir, 'tsconfig.json')))
}

/**
 * The TypeScript the declaration emitter will actually use, plus the range the root catalog pins.
 * `bun check` ignores this entirely (Bun ships its own checker and its own copy of TypeScript's
 * `lib.*.d.ts`); only the emit step below depends on it.
 */
function typescriptVersions() {
  const catalogRange = readJson('package.json').catalog?.typescript ?? null
  const installed = join(ROOT, 'node_modules/typescript/package.json')
  const version = existsSync(installed) ? JSON.parse(readFileSync(installed, 'utf8')).version : null
  return { catalogRange, version }
}

/**
 * Run a command with inherited stdio. Piped child stdio is deliberately avoided: it is not
 * available in every environment this gate has to run in.
 */
function run(command, args, cwd = ROOT) {
  const res = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (res.error) {
    console.error(`  failed to start: ${command} (${res.error.message})`)
    return 1
  }
  return res.status ?? 1
}

/**
 * oxlint is invoked through `bun x` (Bun's own resolver) rather than through
 * `node_modules/.bin`: the .bin shims are Node-based, and oxlint ships a native binary those
 * shims do not wrap. `bun x oxlint` resolves the local install under either linker.
 */
function runOxlint(args) {
  return run('bun', ['x', 'oxlint', ...args])
}

/**
 * Oxfmt is invoked through `bun x` for the same reason as oxlint: it ships a native binary the
 * Node-based .bin shims do not wrap. `--check` exits non-zero when any file would be rewritten.
 */
function runOxfmt(args) {
  return run('bun', ['x', 'oxfmt', ...args])
}

function step(title, fn) {
  const started = Date.now()
  console.log(`\n=== ${title} ===`)
  const result = fn()
  const ms = Date.now() - started
  const ok = result === true || result === 0
  console.log(`${ok ? '✓' : '✗'} ${title} (${(ms / 1000).toFixed(1)}s)`)
  return { ok, title, ms }
}

const results = []

// 1 — unit tests, every package that has any.
if (!flag('no-tests')) {
  results.push(
    step('tests', () => {
      const byPackage = testsByPackage()
      if (!byPackage.size) {
        console.error('No test files found.')
        return 1
      }
      let failed = 0
      for (const [dir, files] of [...byPackage].sort()) {
        console.log(`\n--- bun test (${dir}, ${files.length} file(s)) ---`)
        if (run('bun', ['test'], join(ROOT, dir)) !== 0) failed++
      }
      return failed
    }),
  )
}

// 2 — the declaration emitter has to stay on TypeScript 7. Cheap (two file reads) and it fails
// *before* the emit step, so a wrong toolchain is reported as itself instead of as a pile of
// diagnostics that look like source errors. `bun check` does not care: it brings its own checker.
let typescriptOk = true
if (!QUICK && !TESTS_ONLY && !flag('no-declarations')) {
  const versionStep = step('typescript version (tsc 7.x)', () => {
    const { catalogRange, version } = typescriptVersions()
    console.log(
      `catalog typescript: ${catalogRange ?? '(missing)'}   installed: ${version ?? '(not installed)'}`,
    )
    if (!/^[~^]?7\./.test(String(catalogRange))) {
      console.error(`root catalog must pin typescript to a 7.x range (found ${catalogRange ?? 'nothing'})`)
      return 1
    }
    if (!version) {
      console.error('typescript is not installed under node_modules — run `bun install` at the repo root')
      return 1
    }
    if (version.split('.')[0] !== '7') {
      console.error(`typescript ${version} is installed, but declaration emit is verified against 7.x`)
      return 1
    }
    return 0
  })
  results.push(versionStep)
  typescriptOk = versionStep.ok
}

// 3 — declaration emit, so `dist/*.d.ts` can always be produced before publishing. This is the one
// thing left that needs `tsc`: `bun check` never writes files, and `bun build` has no `.d.ts` mode.
// It runs *before* the type check on purpose: libraries resolve each other through the `types` entry
// of their package.json, so dependents must be checked against freshly emitted declarations rather
// than whatever happens to be on disk. (Verified: without `libs/signal/dist`, `bun check` in
// `libs/jsx6` falls back to signal's *sources* and checks 51 files instead of 40 — still clean, but a
// different surface.)
if (!QUICK && !TESTS_ONLY && !flag('no-declarations')) {
  if (!typescriptOk) {
    console.error('\n=== declaration emit (tsc) ===\nskipped: the TypeScript version check above failed')
    results.push({ ok: false, title: 'declaration emit (tsc)', ms: 0 })
  } else {
    results.push(
      step('declaration emit (tsc)', () => {
        let failed = 0
        for (const dir of libsWithTsconfig()) {
          console.log(`\n--- tsc -p ${dir} ---`)
          if (run('bun', ['x', 'tsc', '-p', 'tsconfig.json'], join(ROOT, dir)) !== 0) {
            failed++
            console.error(`declaration emit failed: ${dir}`)
          }
        }
        return failed
      }),
    )
  }
}

// 4 — JSDoc type checking (`checkJs` lives in each lib's tsconfig.json), by Bun's own checker.
// `bun check` reads the same tsconfig as `tsc --noEmit`, prints the same diagnostics in the
// `tsc --pretty false` format, exits 1 on any error, 0 when clean, writes nothing, and uses every
// core. It is invoked with the cwd set to the package (not `-p <dir>` from the root) because the
// root manifest owns a script named `check` — the gate itself — and Bun prefers a package.json
// script over its built-in subcommand, so a root-level `bun check` would run the whole gate.
// `--no-types` is the historical spelling, kept so old command lines keep meaning the same thing.
if (!TESTS_ONLY && !flag('no-typecheck') && !flag('no-types')) {
  results.push(
    step('type check (bun check)', () => {
      let failed = 0
      for (const dir of libsWithTsconfig()) {
        // Any package script named `check` shadows the built-in checker the same way the root one
        // does. Guard it: otherwise this step would report a pass while checking nothing at all.
        if (readJson(`${dir}/package.json`).scripts?.check) {
          console.error(`${dir}: a "check" script shadows the built-in \`bun check\` — rename it`)
          failed++
          continue
        }
        console.log(`\n--- bun check (${dir}) ---`)
        if (run('bun', ['check'], join(ROOT, dir)) !== 0) {
          failed++
          console.error(`type check failed: ${dir}`)
        }
      }
      return failed
    }),
  )
}

// 5 — optional: build lib bundles first, so the tarball assertions below have something to see.
// Off by default because it adds the full esbuild pass; `scripts/publish.js` always builds before
// running the gate with --require-built.
if (flag('build') && !QUICK && !TESTS_ONLY) {
  results.push(
    step('build lib bundles', () => {
      let failed = 0
      for (const dir of libsWithTsconfig()) {
        const pkg = readJson(`${dir}/package.json`)
        for (const script of ['build', 'build-cjs']) {
          if (!pkg.scripts?.[script]) continue
          console.log(`\n--- bun run ${script} (${dir}) ---`)
          if (run('bun', ['run', script], join(ROOT, dir)) !== 0) {
            failed++
            console.error(`build failed: ${dir} (${script})`)
          }
        }
      }
      return failed
    }),
  )
}

// 6 — lint (library, tool and script sources; the jsx6/signal-dependencies JS-plugin rule
// lives here). `--deny-warnings` matters: the custom rule reports at warning severity, so
// without it a broken rule would silently stop gating anything (the same trap as ESLint's
// `--max-warnings 0`).
if (!QUICK && !TESTS_ONLY && !flag('no-lint')) {
  results.push(step('oxlint', () => runOxlint(['libs', 'tools', 'scripts', '--deny-warnings'])))
}

// 7 — format check: the whole tree must already be Oxfmt-clean, so `bun run format` stays a
// no-op. It is the format counterpart of the oxlint step above (same `bun x` invocation style).
if (!QUICK && !TESTS_ONLY && !flag('no-format')) {
  results.push(step('oxfmt (format check)', () => runOxfmt(['--check'])))
}

// 8 — dependency catalog hygiene.
if (!QUICK && !TESTS_ONLY && !flag('no-versions')) {
  results.push(step('dependency versions', () => run('bun', ['run', 'scripts/check-versions.js'])))
}

// 9 — the committed docs site must match what `docs:build` produces from apps/repl/static (P4-2).
if (!QUICK && !TESTS_ONLY && !flag('no-docs')) {
  results.push(
    step('docs sync', () => {
      const { errors, warnings, checked } = checkDocs({
        syntax: true,
        // --build already pays for the esbuild pass, so it also gets the strongest check.
        rebuild: flag('build'),
      })
      for (const w of warnings) console.log(`[warn] ${w}`)
      for (const e of errors) console.error(`[error] ${e}`)
      if (errors.length) console.error('Run: bun run docs:build')
      console.log(`checked ${checked} docs file(s)`)
      return errors.length
    }),
  )
}

// 10 — manifest + tarball audit.
if (!QUICK && !TESTS_ONLY && !flag('no-manifests')) {
  results.push(
    step('manifest audit', () => {
      const { errors, warnings } = auditManifests({
        pack: !flag('no-pack'),
        // --build produces every declared output, so the audit can then demand that each one
        // really is inside the tarball.
        requireBuilt: flag('require-built') || flag('build'),
      })
      for (const w of warnings) console.log(`[warn] ${w}`)
      for (const e of errors) console.error(`[error] ${e}`)
      return errors.length
    }),
  )
}

// 11 — workspace integrity: one package manager, no Rush artifacts, no version drift (R3/R4).
// Cheap (pure file/manifest reads), so it is a full-gate step rather than a --quick one.
if (!QUICK && !TESTS_ONLY && !flag('no-workspace')) {
  results.push(step('workspace integrity', () => run('bun', ['run', 'scripts/check-workspace.js'])))
}

if (!results.length) {
  console.error('Nothing to do: all steps were disabled.')
  process.exit(2)
}

const failed = results.filter(r => !r.ok)
const total = (results.reduce((sum, r) => sum + r.ms, 0) / 1000).toFixed(1)
console.log('\n================ gate summary ================')
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.title} (${(r.ms / 1000).toFixed(1)}s)`)
console.log(`total ${total}s`)

if (failed.length) {
  console.error(`\n${failed.length} step(s) failed: ${failed.map(f => f.title).join(', ')}`)
  process.exit(1)
}
console.log('\nAll checks passed.')
