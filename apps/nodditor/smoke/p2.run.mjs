// Runner for the P2 smoke suite: bundles the .jsx sources + suite with esbuild
// (same settings as the app build), boots the happy-dom globals, then imports
// the bundle so the editor code evaluates against the DOM.
//
//   cd apps/nodditor && node smoke/p2.run.mjs
//
// Named `p2.smoke.jsx` (not `*.test.jsx`) so `bun test` never runs it directly
// — see the note in p1.run.mjs; the unit tests live in ../test/.
//
// IntersectionObserver is stubbed like in p1.run.mjs (happy-dom 14 lacks it).

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

// run from the app root: node smoke/p2.run.mjs
// NOTE: must mirror the app build's tsconfig (empty) — esbuild would otherwise
// auto-pick apps/nodditor/tsconfig.json whose `jsx: "preserve"` emits raw JSX.
await esbuild.build({
  absWorkingDir: process.cwd(),
  tsconfig: 'tsconfig-custom.json',
  entryPoints: ['smoke/p2.smoke.jsx'],
  outfile: 'smoke/p2.bundle.mjs',
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

await import(pathToFileURL('smoke/p2.bundle.mjs').href)
