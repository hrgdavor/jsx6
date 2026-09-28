import { runEsbuild } from '@jsx6/build'
import * as esbuild from 'esbuild'

import { esbDef } from './esbDef.js'

/**
 * Build the vanilla demo (`static/vanilla/`) into `build_vanilla/`, and copy the stylesheets it
 * links (the library's `nodditor.css` + the demo look `ne-blocks.css`) plus the demo's own files.
 *
 * Separate from the app build on purpose: the vanilla demo is the *minimal* host, so it must not
 * share an entry point with the JSX demo page (`src/index.jsx`). If a library change breaks this
 * build, that is the signal that something leaked into the essential path.
 */
const staticDir = 'static/vanilla'
const outDir = 'build_vanilla'

const dev = process.argv.includes('--dev')

/**
 * Stylesheets linked from the package's `static/`. `nodditor.css` is the library geometry the editor
 * needs; `ne-blocks.css` is the demo's block/connector look. (The vanilla demo links them straight
 * from `static/vanilla/index.html`; the bundle only copies them next to the built html.)
 */
export const VANILLA_CSS = ['nodditor.css', 'ne-blocks.css']

export async function buildVanilla(out = outDir, options = {}) {
  await runEsbuild(esbuild, {
    ...esbDef,
    ...options,
    entryPoints: [`${staticDir}/boot.js`],
    outdir: out,
    skipExisting: false,
  })
  return out
}

export async function copyVanillaAssets(out = outDir) {
  const { copyTask } = await import('@jsx6/build')
  // the demo's own html/css/demo.js (boot.js is bundled, README.md is documentation, not an asset)
  copyTask(staticDir, out, {
    include: [],
    exclude: ['boot.js', 'README.md'],
    watch: dev,
    filters: [],
  })
  // the package's block + editor stylesheets, so the demo renders like the real thing
  copyTask('static', out, { include: VANILLA_CSS, exclude: [], watch: dev, filters: [] })
  return out
}

if (import.meta.main) {
  await buildVanilla()
  await copyVanillaAssets()
  console.log('*************    VANILLA DEMO BUILD SUCCESS    ***********')
}
