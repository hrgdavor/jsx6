import { runEsbuild } from '@jsx6/build'
import * as esbuild from 'esbuild'

import { esbDef } from './esbDef.js'

// The definition itself lives in `esbDef.js` so the app build and the vanilla-demo build share
// exactly one copy of it; re-exported because this module was the original home.
export { esbDef }

export async function buildScript(src, to, file, options = {}) {
  let ctx = await runEsbuild(esbuild, {
    ...esbDef,
    ...options,
    entryPoints: [`${src}/${file}`],
    outdir: to,
  })
}
