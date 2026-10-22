import { expect, test, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

// The inspector installs a DOM listener, so the test needs a DOM. Registering must happen
// before the dev runtime is imported: the test imports it dynamically for that reason.
GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

/** @type {Array<{target: EventTarget, type: string}>} */
const registeredListeners = []
const realAddEventListener = EventTarget.prototype.addEventListener
EventTarget.prototype.addEventListener = function (type, listener, options) {
  registeredListeners.push({ target: this, type })
  return realAddEventListener.call(this, type, listener, options)
}

/** @returns {EventTarget[]} roots that got the inspector contextmenu listener */
const inspectorRoots = () =>
  registeredListeners.filter(entry => entry.type === 'contextmenu').map(entry => entry.target)

// P2-5: importing the dev runtime used to call `activateJsxInspector()` at module load, while
// the package declared `"sideEffects": false`. The inspector must now be installed lazily (on
// the first `jsxDEV` call) or explicitly, and never as a side effect of importing the module.
test('importing the dev runtime installs nothing, first jsxDEV call installs the inspector', async () => {
  const mod = await import('./index.js')

  // no import-time side effect
  expect(inspectorRoots()).toEqual([])
  expect(mod.isInspectorInstalled()).toBe(false)
  expect(mod.isInspectorInstalled(document.body)).toBe(false)

  // lazily installed on first use, which keeps the existing dev behaviour
  const el = mod.jsxDEV('DIV', { children: 'hi' })
  expect(el).toBeInstanceOf(HTMLElement)
  expect(inspectorRoots()).toEqual([document.body])
  expect(mod.isInspectorInstalled()).toBe(true)

  // and only once
  mod.jsxDEV('SPAN', { children: 'again' })
  expect(inspectorRoots()).toEqual([document.body])
})

test('installInspector() installs explicitly and is idempotent per root', async () => {
  const mod = await import('./index.js')

  const root = document.createElement('div')
  expect(mod.isInspectorInstalled(root)).toBe(false)
  expect(mod.installInspector(root)).toBe(true)
  expect(mod.isInspectorInstalled(root)).toBe(true)
  expect(mod.installInspector(root)).toBe(false) // already installed
  expect(inspectorRoots().filter(target => target === root).length).toBe(1)

  // document.body was installed by the lazy path in the previous test
  expect(mod.isInspectorInstalled(document.body)).toBe(true)

  // a default root is used when none is given
  expect(mod.installInspector()).toBe(false)
  expect(mod.installInspector(undefined)).toBe(false)
})

// `globalThis.JSX6_DEV_INSPECTOR = false` opts out of the automatic installation, and must be
// read per call so it can be set by the host page at any time. A fresh module instance is
// imported with a cache-busting query so the assertion is not affected by the tests above.
test('JSX6_DEV_INSPECTOR=false opts out of the automatic installation', async () => {
  ;/** @type {any} */ (globalThis).JSX6_DEV_INSPECTOR = false
  try {
    const mod = await import('./index.js?optout')
    const before = inspectorRoots().length
    mod.jsxDEV('DIV', { children: 'no inspector' })
    expect(inspectorRoots().length).toBe(before)
    expect(mod.isInspectorInstalled()).toBe(false)
    // the explicit call still works, it is not an implicit installation
    expect(mod.installInspector()).toBe(true)
    expect(mod.isInspectorInstalled()).toBe(true)
  } finally {
    delete (/** @type {any} */ (globalThis).JSX6_DEV_INSPECTOR)
  }
})

// Tooling (jsxed's inspect mode) has to tell a component instance from an intrinsic tag even when
// the component's root tag is lowercase (`Panel` renders a `section`). `_source` alone cannot: the
// class root keeps its template source, and a functional component's usage source is only one range.
// The dev runtime therefore marks the rendered root with the component's identity.
test('component roots carry the component identity, intrinsic tags do not', async () => {
  const mod = await import('./index.js')
  const source = { fileName: 'demo.jsx', lineNumber: 7, columnNumber: 3 }

  // functional component: the returned node is the root
  const Greeting = () =>
    mod.jsxDEV('P', { children: 'hi' }, undefined, false, { fileName: 'demo.jsx', lineNumber: 2 })
  const greeting = mod.jsxDEV(Greeting, {}, undefined, false, source)
  expect(greeting._component).toBe('Greeting')
  expect(greeting._source).toBe(source)

  // class component: the instance exposes its rendered root as `.el`
  class Panel {
    constructor() {
      this.el = document.createElement('section')
    }
  }
  const panel = mod.jsxDEV(Panel, {}, undefined, false, source)
  expect(panel).toBeInstanceOf(Panel)
  expect(panel.el._component).toBe('Panel')

  // intrinsic tag: no identity to mark
  const div = mod.jsxDEV('DIV', {}, undefined, false, source)
  expect(div._component).toBeUndefined()
  expect(div._source).toBe(source)
})
