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
export const aliasPlugin = dir => {
  const core = join(dir, 'signal/index.js')
  const filter = /^@jsx6\/signal(\/.*)?$/
  return {
    name: 'jsx6-signal-alias',
    setup(build) {
      build.onResolve({ filter }, args => {
        if (!existsSync(core)) {
          throw new Error(`direction has no copied core: ${core}`)
        }
        if (args.path === '@jsx6/signal') return { path: core }
        return { path: join(dir, 'signal', args.path.slice('@jsx6/signal'.length)) }
      })
    },
  }
}

/** Resolve a direction id to its directory, or null for the un-aliased baseline. */
export const directionDir = id => {
  if (id === 'baseline' || id === 'none') return null
  const dir = join(HERE, '..', id)
  if (!existsSync(join(dir, 'signal/index.js'))) {
    throw new Error(
      `direction "${id}" has no copied core (only B and C do). Aliasing a real app against A/E/F ` +
        `would only redirect the entry module, not the core, so it would not be a fair comparison.`,
    )
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