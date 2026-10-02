import { runEsbuild } from '@jsx6/build'
import * as esbuild from 'esbuild'

/**
 * The esbuild definition shared by every nodditor bundle (the app page and the vanilla demo).
 *
 * `loader: { '.js': 'tsx' }` is what lets this package keep `.js` files that contain JSX, and
 * `jsxImportSource: '@jsx6'` is the build-time half of the JSX contract (see `src/runtime.js`).
 */
// #region esbDef
export const esbDef = {
  tsconfig: `tsconfig-custom.json`,
  jsx: 'automatic',
  jsxImportSource: '@jsx6',
  format: 'esm',
  loader: { '.js': 'tsx', '.jsx': 'tsx' },
  bundle: true,
  minify: true,
  skipExisting: true,
  sourcemap: true,
}
// #endregion esbDef

export async function buildScript(src, to, file, options = {}) {
  let ctx = await runEsbuild(esbuild, {
    ...esbDef,
    ...options,
    entryPoints: [`${src}/${file}`],
    outdir: to,
  })
}
