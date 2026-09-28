// Runner for `doc/feeding-data.example.js` — the copy-pasteable fix for the host's fill path.
//
//   cd apps/nodditor && node doc/feeding-data.run.mjs
//
// Same shape as `smoke/*.run.mjs`: the editor extends `HTMLElement` at module-evaluation time, so the
// DOM globals and the library stylesheet must exist before the example runs (the example asserts the
// canvas class, which is why the stylesheet is loaded too).

import esbuild from 'esbuild'
import { pathToFileURL } from 'url'

import { setupDom } from '../smoke/dom-setup.mjs'

await setupDom()

await esbuild.build({
  absWorkingDir: process.cwd(),
  tsconfig: 'tsconfig-custom.json',
  entryPoints: ['doc/feeding-data.example.js'],
  outfile: 'doc/feeding-data.bundle.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'esnext',
  jsx: 'automatic',
  jsxImportSource: '@jsx6',
  loader: { '.js': 'tsx', '.jsx': 'tsx' },
  minify: false,
  sourcemap: false,
  logLevel: 'warning',
})

await import(pathToFileURL('doc/feeding-data.bundle.mjs').href)
