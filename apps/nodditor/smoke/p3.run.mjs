// Runner for the P3 smoke suite: bundles the .jsx sources + suite with esbuild
// (same settings as the app build), boots the happy-dom globals, then imports
// the bundle so the editor code evaluates against the DOM.
//
//   cd apps/nodditor && node smoke/p3.run.mjs
//
// Named `p3.smoke.jsx` (not `*.test.jsx`) so `bun test` never runs it directly
// — see the note in p1.run.mjs; the unit tests live in ../test/.
//
// IntersectionObserver is stubbed like in p1/p2 (happy-dom 14 lacks it).
// ResizeObserver is stubbed too: happy-dom has no layout, so its observer never
// fires — the stub keeps the callback on the instance (`observer.cb`) so the
// test can deliver resize entries to the editor's real handler.

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

globalThis.ResizeObserver = class {
  constructor(callback) {
    this.cb = callback
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

// run from the app root: node smoke/p3.run.mjs
// NOTE: must mirror the app build's tsconfig (empty) — esbuild would otherwise
// auto-pick apps/nodditor/tsconfig.json whose `jsx: "preserve"` emits raw JSX.
await esbuild.build({
  absWorkingDir: process.cwd(),
  tsconfig: 'tsconfig-custom.json',
  entryPoints: ['smoke/p3.smoke.jsx'],
  outfile: 'smoke/p3.bundle.mjs',
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

await import(pathToFileURL('smoke/p3.bundle.mjs').href)
