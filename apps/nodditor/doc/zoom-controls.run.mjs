// Runner for `doc/zoom-controls.example.js`: boot happy-dom globals, then import the example.
//
//   cd apps/nodditor && node doc/zoom-controls.run.mjs
//
// Same shape as `smoke/*.run.mjs`: the editor extends `HTMLElement` at module-evaluation time, so the
// DOM globals have to exist before the example's import runs. `IntersectionObserver` is stubbed
// because happy-dom 14 does not implement it and `@jsx6/dom-observer` constructs one.

import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { pathToFileURL } from 'url'

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

await import(pathToFileURL('doc/zoom-controls.bundle.mjs').href)
