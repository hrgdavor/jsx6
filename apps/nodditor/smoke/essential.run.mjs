// Runner for the essential-surface audit: bundle the vanilla demo + library with esbuild (same
// settings as the app build), boot happy-dom globals, then import the bundle so the editor code
// evaluates against the DOM.
//
//   cd apps/nodditor && node smoke/essential.run.mjs
//
// The suite is named `essential.smoke.js` (not `*.test.js`) on purpose: it needs the globals and
// the bundling done HERE, so `bun test` must not pick it up.
//
// IntersectionObserver is stubbed: happy-dom 14 does not implement it, and `@jsx6/dom-observer`
// constructs one per connector.

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
  takeRecords() {
    return []
  }
}

// run from the app root: node smoke/essential.run.mjs
// NOTE: must mirror the app build's tsconfig (empty) — esbuild would otherwise auto-pick
// apps/nodditor/tsconfig.json whose `jsx: "preserve"` emits raw JSX.
await esbuild.build({
  absWorkingDir: process.cwd(),
  tsconfig: 'tsconfig-custom.json',
  entryPoints: ['smoke/essential.smoke.js'],
  outfile: 'smoke/essential.bundle.mjs',
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

await import(pathToFileURL('smoke/essential.bundle.mjs').href)
