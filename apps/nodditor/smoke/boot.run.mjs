// Runner for the boot smoke test: builds the two demo pages as separate bundles, boots happy-dom
// globals, then runs `boot.smoke.js` (which imports those bundles).
//
//   cd apps/nodditor && node smoke/boot.run.mjs
//
// The two pages are bundled rather than imported so that a module-level failure inside them is
// exercised exactly as a browser would evaluate them. `boot.smoke.js` itself is bundled too, so its
// static import of NodeEditor resolves the same way.

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

// run from the app root: node smoke/boot.run.mjs
const shared = {
  absWorkingDir: process.cwd(),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'esnext',
  jsx: 'automatic',
  jsxImportSource: '@jsx6',
  tsconfig: 'tsconfig-custom.json',
  loader: { '.js': 'tsx', '.jsx': 'tsx' },
  minify: false,
  sourcemap: false,
  logLevel: 'warning',
}

// the JSX demo page — the module that once failed to boot
await esbuild.build({ ...shared, entryPoints: ['src/index.jsx'], outfile: 'smoke/boot-page.bundle.mjs' })
// the suite
await esbuild.build({ ...shared, entryPoints: ['smoke/boot.smoke.js'], outfile: 'smoke/boot.bundle.mjs' })

await import(pathToFileURL('smoke/boot.bundle.mjs').href)
