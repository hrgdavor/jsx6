/**
 * Runnable example: the three observer helpers, their sharing rules and their disposers.
 *
 *   node libs/dom-observer/doc/usage.example.mjs
 *
 * No DOM is needed. The package treats an element as an opaque object — it is the key of a per-element
 * callback map and is handed to the observer, nothing else — so the example uses plain objects as
 * elements and replaces both observers with recording stubs. That is also exactly how a consumer has to
 * test this package under happy-dom 14, where `IntersectionObserver` does not exist at all.
 *
 * The stubs must be installed BEFORE the import: importing the package constructs its shared
 * `ResizeObserver` at module scope.
 *
 * The file is named `*.example.mjs` (not `*.test.js`) on purpose: it is documentation that happens to
 * assert, not part of the package test suite.
 */
import assert from 'node:assert/strict'

const resizeObservers = []
const intersectObservers = []

/** Records what is observed, so the sharing rules are visible instead of assumed. */
class RecordingObserver {
  constructor(callback, options, list) {
    this.cb = callback
    this.options = options
    this.observed = []
    this.unobserved = []
    list.push(this)
  }
  observe(el, options) {
    this.observed.push(options === undefined ? el : [el, options])
  }
  unobserve(el) {
    this.unobserved.push(el)
  }
  disconnect() {
    this.unobserved.push('*')
  }
  takeRecords() {
    return []
  }
}

globalThis.ResizeObserver = class extends RecordingObserver {
  constructor(callback, options) {
    super(callback, options, resizeObservers)
  }
}
globalThis.IntersectionObserver = class extends RecordingObserver {
  constructor(callback, options) {
    super(callback, options, intersectObservers)
  }
}

const { observeInit, observeIntersect, observeResize, observeShowHide } = await import('../index.js')

// Importing the package already created the one shared ResizeObserver; the IntersectionObserver is
// created lazily, on the first `observeIntersect`/`observeShowHide` call.
assert.equal(resizeObservers.length, 1)
assert.equal(intersectObservers.length, 0)

// #region demo
// An element is opaque here; in an app it is a DOM node. An intersection `root` is both the
// intersection root and the key that shares one observer per root + options pair.
const graph = {}
const port = {}

// Report visibility changes: `observeShowHide` is `observeIntersect` with a show/hide threshold.
const stopVisibility = observeShowHide(
  port,
  entry => console.log('intersectionRatio', entry.intersectionRatio),
  { root: graph },
)

// Report size changes: one ResizeObserver is shared by every element and every callback in the page.
const stopResize = observeResize(port, entry => console.log('width', entry.contentRect.width))

// Every call returns its own disposer. The element is unobserved only when its last callback goes.
stopVisibility()
stopResize()
// #endregion demo

// ------------------------------------------------------------------------------------------------
// The demo above is deliberately small; the rest of this file pins the rules the page states.
// ------------------------------------------------------------------------------------------------

// The first `observeShowHide` call created one IntersectionObserver, with its shared default threshold,
// and both observers were asked to observe the same element exactly once.
assert.equal(intersectObservers.length, 1)
const visibilityIO = intersectObservers[0]
assert.equal(visibilityIO.observed.length, 1)
assert.deepEqual(visibilityIO.options.threshold, [0, 0.0001])
assert.equal(visibilityIO.unobserved.length, 1) // the disposer unobserved the element
assert.deepEqual(resizeObservers[0].observed, [port])
assert.deepEqual(resizeObservers[0].unobserved, [port])

// Sharing: the same root and the same options reuse the observer; a new root or a new threshold gets
// its own. This is the whole point of the package — one observer per root + options, not per element.
const other = {}
const stopA = observeShowHide({}, () => {}, { root: graph })
const stopB = observeShowHide({}, () => {}, { root: graph })
assert.equal(intersectObservers.length, 1) // still the same shared observer
observeIntersect({}, () => {}, { root: graph, threshold: 0.5 })
assert.equal(intersectObservers.length, 2) // a different threshold is a different observer
observeShowHide({}, () => {}, { root: other })
assert.equal(intersectObservers.length, 3) // a different root has its own pool
observeIntersect({}, () => {}, { threshold: 0.5 })
assert.equal(intersectObservers.length, 4) // no root: the module-level pool
stopA()
stopB()

// `detail` builds a threshold ladder when no `threshold` is given.
observeIntersect({}, () => {}, { detail: 0.01 })
const ladder = intersectObservers.at(-1).options.threshold
assert.equal(ladder.length, 101)
assert.equal(ladder[0], 0)
assert.equal(ladder[1], 0.01)
assert.equal(ladder[ladder.length - 1], 1)

// Entries are routed to the callbacks registered for that element only.
const elA = {}
const elB = {}
const fromA = []
const fromB = []
const stopFromA = observeResize(elA, entry => fromA.push(entry.contentRect.width))
observeResize(elB, entry => fromB.push(entry.contentRect.width))
const resize = resizeObservers[0]
resize.cb([
  { target: elA, contentRect: { width: 10 } },
  { target: elB, contentRect: { width: 20 } },
])
assert.deepEqual(fromA, [10])
assert.deepEqual(fromB, [20])

// Two callbacks on one element: one disposer removes only its own callback, and the element is
// unobserved when the last one is gone. Calling a disposer twice is a no-op.
const first = []
const second = []
const stopFirst = observeResize(elA, entry => first.push(entry.contentRect.width))
const stopSecond = observeResize(elA, entry => second.push(entry.contentRect.width))
resize.cb([{ target: elA, contentRect: { width: 30 } }])
assert.deepEqual(first, [30])
assert.deepEqual(second, [30])
stopFirst()
stopFirst() // idempotent
resize.cb([{ target: elA, contentRect: { width: 40 } }])
assert.deepEqual(first, [30])
assert.deepEqual(second, [30, 40])
stopSecond()
assert.equal(resize.unobserved.length, 1) // still one callback left on elA
stopFromA()
assert.equal(resize.unobserved.length, 2) // now the last one is gone

// `observeInit` is the one-shot variant: it reports the first visible state and then stops. It returns
// no disposer, so it cannot be cancelled.
const initEl = {}
const once = []
observeInit(initEl, entry => once.push(entry.intersectionRatio), { root: graph })
// It shares the observer created for `graph` with the default show/hide threshold.
const initIO = intersectObservers[0]
initIO.cb([{ target: initEl, intersectionRatio: 0 }])
assert.deepEqual(once, []) // not visible: still waiting
initIO.cb([{ target: initEl, intersectionRatio: 0.5 }])
assert.deepEqual(once, [0.5])
assert.equal(typeof observeInit({}, () => {}, { root: graph }), 'undefined') // nothing to cancel with

console.log('dom-observer example: all assertions passed')
