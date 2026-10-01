/**
 * Seam suite: prove that nodditor runs on a REPLACED backend, and that the replacement is the only
 * thing standing between the editor and the `@jsx6` packages.
 *
 * Script-style suite, deliberately not `*.test.jsx`: it needs the DOM globals and the bundling done
 * here, so `bun test` must not pick it up. `npm`/`bun test` cover the static half of this contract
 * in `test/runtime.test.js`; the part that needs a booted editor lives here.
 *
 *   cd apps/nodditor
 *   node smoke/seam.run.mjs
 *
 * The suite is not just "does it still work" — it asserts that the editor's calls actually ARRIVE at
 * the replacement. A replacement that is silently bypassed would otherwise pass unnoticed.
 */
import { readFileSync } from 'fs'
import esbuild from 'esbuild'
import { pathToFileURL } from 'url'

const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
GlobalRegistrator.register({ url: 'http://localhost/' })

// happy-dom 14 does not implement IntersectionObserver (see test/setup.js and smoke/p1.run.mjs).
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

// The suite asserts computed styles (SEAM-5 stacking) — happy-dom does not pick up `<link>` tags,
// so install the library stylesheet the way a browser would, before the editor is imported.
const style = document.createElement('style')
style.textContent = readFileSync('static/nodditor.css', 'utf8')
document.head.appendChild(style)

// run from the app root: node smoke/seam.run.mjs
// NOTE: must mirror the app build's tsconfig (empty) — esbuild would otherwise auto-pick
// apps/nodditor/tsconfig.json whose `jsx: "preserve"` emits raw JSX.
await esbuild.build({
  absWorkingDir: process.cwd(),
  tsconfig: 'tsconfig-custom.json',
  entryPoints: ['smoke/seam.smoke.jsx'],
  outfile: 'smoke/seam.bundle.mjs',
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

await import(pathToFileURL('smoke/seam.bundle.mjs').href)
