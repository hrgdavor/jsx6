/**
 * DIRECTION D, part 2 — build the **real app** against a candidate signal backend.
 *
 * This is the step that makes "use it for a day, then decide" possible: `apps/repl` is bundled with
 * `@jsx6/signal` (and only that specifier, plus its subpaths) redirected to a direction's copied core.
 * Not a line of app source changes — the redirect happens in an esbuild plugin at resolve time, so the
 * same `index.jsx`, the same `TutorialRunner`, the same `Loop`, directives and forms run on top of a
 * different reactivity core.
 *
 * The build options are *imported* from the app's own `src_build/buildScript.js` (`esbDef`) rather than
 * duplicated, so the comparison cannot drift from how the app is really built. `src_build/build.js`
 * itself is untouched: this runner calls esbuild directly and writes to a scratch directory under
 * `experiments/`.
 *
 * `baseline` builds the app with no alias at all — the control, i.e. the shipped core.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'fs'
import { dirname, join, resolve } from 'path'
import * as esbuild from 'esbuild'
import { esbDef } from '../../../apps/repl/src_build/buildScript.js'

const HERE = import.meta.dir
const ROOT = resolve(HERE, '../../..')
const APP_DIR = join(ROOT, 'apps/repl')
/** `.tmp` is ignored by git, oxlint and oxfmt, so builds never pollute the tree. */
export const BUILD_ROOT = join(HERE, '.tmp/app-build')

export const ENTRIES = ['index.jsx', 'editor.jsx', 'demistify.jsx', 'random.tricks.jsx']

/**
 * esbuild plugin that redirects `@jsx6/signal` (and `@jsx6/signal/...`) to a copied core.
 * @param {string} dir absolute path of the direction directory (contains `signal/index.js`)
 */
/**
 * Known app targets. `dir` is resolved relative to this file; `core` is the entry module that replaces
 * `@jsx6/signal`, and is detected so both layouts work: an experiment direction keeps its core in
 * `<dir>/signal/`, a real package has it at its root.
 *
 *   pre-1.9            the frozen 1.8.18 control (aliased)
 *   shipped            no alias at all — the app resolves @jsx6/signal through the workspace, i.e. B
 *   signal-alien       the new @jsx6/signal-alien package (aliased)
 *   b-native-computed  the B reference implementation in experiments/
 *   c-alien-backend    the C reference implementation in experiments/
 */
export const APP_TARGETS = {
  'pre-1.9': { dir: '../baseline', marker: { needle: 'signalAlienSource', expect: false } },
  shipped: { dir: null, marker: { needle: 'signalStateChildren', expect: true } },
  'signal-alien': { dir: '../../../libs/signal-alien', marker: { needle: 'signalAlienSource', expect: true } },
  'b-native-computed': { dir: '../b-native-computed', marker: { needle: 'signalStateChildren', expect: true } },
  'c-alien-backend': { dir: '../c-alien-backend', marker: { needle: 'signalAlienSource', expect: true } },
}

/** The entry module of a target's core: `<dir>/signal/index.js` or `<dir>/index.js`. */
export const coreEntryOf = dir => {
  const copied = join(dir, 'signal/index.js')
  return existsSync(copied) ? copied : join(dir, 'index.js')
}

export const aliasPlugin = dir => {
  const core = coreEntryOf(dir)
  const filter = /^@jsx6\/signal(\/.*)?$/
  return {
    name: 'jsx6-signal-alias',
    setup(build) {
      build.onResolve({ filter }, args => {
        if (!existsSync(core)) {
          throw new Error(`target has no core entry: ${core}`)
        }
        if (args.path === '@jsx6/signal') return { path: core }
        const sub = args.path.slice('@jsx6/signal'.length)
        const copied = join(dir, 'signal', sub)
        return { path: existsSync(copied) ? copied : join(dir, sub) }
      })
    },
  }
}

/** Resolve an app target id to its directory, or null for `shipped` (the un-aliased workspace core). */
export const directionDir = id => {
  if (id === 'none') return null
  const target = APP_TARGETS[id]
  if (!target) {
    throw new Error(`unknown app target "${id}" — known: ${Object.keys(APP_TARGETS).join(', ')}`)
  }
  if (!target.dir) return null
  const dir = join(HERE, target.dir)
  if (!existsSync(coreEntryOf(dir))) {
    throw new Error(`target "${id}" has no core entry (${coreEntryOf(dir)})`)
  }
  return resolve(dir)
}

/**
 * Build the app entries for one direction.
 * @param {{ id: string, entries?: string[], minify?: boolean }} options
 * @returns {Promise<{ outDir: string, sizes: Record<string, number>, totalJsBytes: number }>}
 */
export async function buildApp({ id, entries = ENTRIES, minify = false }) {
  const dir = directionDir(id)
  const outDir = join(BUILD_ROOT, id)
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  // Static assets the pages need (html, md, jsx2dom.js). Vendored monaco/babel are not copied: they
  // are only needed by the editor/demistify pages in a real browser, not by the headless smoke.
  cpSync(join(APP_DIR, 'static'), outDir, { recursive: true })

  // `skipExisting`/`watch` are `@jsx6/build` wrapper options, not esbuild options — strip them.
  const { skipExisting, watch, tsconfig, ...esbuildOptions } = esbDef
  void skipExisting
  void watch
  // Absolute paths everywhere: esbuild's service fixes its working directory when the module is first
  // used, so relying on `process.chdir` is not reliable.
  await esbuild.build({
    ...esbuildOptions,
    absWorkingDir: APP_DIR,
    tsconfig: join(APP_DIR, tsconfig || 'tsconfig.json'),
    minify,
    sourcemap: false,
    outdir: outDir,
    entryPoints: entries.map(e => join(APP_DIR, 'src', e)),
    plugins: dir ? [aliasPlugin(dir)] : [],
    logLevel: 'warning',
  })

  const sizes = {}
  let totalJsBytes = 0
  for (const e of entries) {
    const js = join(outDir, e.replace(/\.jsx$/, '.js'))
    if (!existsSync(js)) continue
    const bytes = statSync(js).size
    sizes[e] = bytes
    totalJsBytes += bytes
  }
  return { outDir, sizes, totalJsBytes }
}

/** Does the bundle contain the given implementation? Used to prove the alias actually took effect. */
export const bundleContains = (outDir, needle) =>
  readFileSync(join(outDir, 'index.js'), 'utf8').includes(needle)

if (import.meta.main) {
  const id = process.argv[2] || 'baseline'
  const { outDir, sizes, totalJsBytes } = await buildApp({ id })
  console.log(`built ${id} → ${outDir}`)
  for (const [e, bytes] of Object.entries(sizes)) console.log(`  ${e.padEnd(20)} ${(bytes / 1024).toFixed(1)} kB`)
  console.log(`  ${'total'.padEnd(20)} ${(totalJsBytes / 1024).toFixed(1)} kB`)
}

export { APP_DIR, ROOT, dirname }