/**
 * Boot the DOM for the nodditor tests.
 *
 * Imported FIRST by every DOM-level test file (`.test.jsx`), before the editor sources: the editor
 * extends `HTMLElement` at module-evaluation time, so the happy-dom globals have to exist by then.
 *
 * `IntersectionObserver` is stubbed because happy-dom 14 does not implement it and
 * `@jsx6/dom-observer` (`observeShowHide`, used by `connectorUtil.findConnector` to notice a
 * connector element leaving the DOM) constructs one. The stub only has to be constructible and
 * silent: every observed connector is then removed through `removeConnector`, which the tests call
 * directly. The smoke suites stub it the same way (see `smoke/p1.run.mjs`).
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator'

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
