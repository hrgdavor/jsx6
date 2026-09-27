import { runEsbuild } from '@jsx6/build'
import * as esbuild from 'esbuild'

import { esbDef } from './esbDef.js'

/**
 * Build the vanilla demo (`static/vanilla/`) into `build_vanilla/`, and copy the stylesheets it
 * links (the package's own `NodeEditor.css`/`ne-blocks.css` plus the demo's own files).
 *
 * Separate from the app build on purpose: the vanilla demo is the *minimal* host, so it must not
 * share an entry point with the JSX demo page (`src/index.jsx`). If a library change breaks this
 * build, that is the signal that something leaked into the essential path.
 */
const staticDir = 'static/vanilla'
const outDir = 'build_vanilla'

const dev = process.argv.includes('--dev')

/** Stylesheets the demo links from the package's `static/`: everything about blocks and lines. */
export const VANILLA_CSS = ['NodeEditor.css', 'ne-blocks.css']

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
