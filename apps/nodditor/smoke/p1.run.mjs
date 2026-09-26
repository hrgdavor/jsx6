// Runner for the P1 smoke test: bundle the .jsx sources + test with esbuild
// (same settings as the app build), boot happy-dom globals, then import the
// bundle so the editor code evaluates against the DOM.
//
//   cd apps/nodditor && node smoke/p1.run.mjs
//
// IntersectionObserver is stubbed: happy-dom 14 does not implement it, and the
// tests exercise `removeConnector` directly (the real browser IO fires the same
// callback with intersectionRatio 0 when the connector element detaches).

import esbuild from 'esbuild'
import { pathToFileURL } from 'url'

const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
GlobalRegistrator.register({ url: 'http://localhost/' })

globalThis.IntersectionObserver = class {
  constructor(callback) {
    this.callback = callback
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

// run from the app root: node smoke/p1.run.mjs
// NOTE: must mirror the app build's tsconfig (empty) — esbuild would otherwise
// auto-pick apps/nodditor/tsconfig.json whose `jsx: "preserve"` emits raw JSX.
await esbuild.build({
  absWorkingDir: process.cwd(),
  tsconfig: 'tsconfig-custom.json',
  entryPoints: ['smoke/p1.test.jsx'],
  outfile: 'smoke/p1.bundle.mjs',
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

await import(pathToFileURL('smoke/p1.bundle.mjs').href)
