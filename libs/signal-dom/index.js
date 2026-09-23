import { observeNow } from '@jsx6/signal'

const dirty = new Set()
let isRunning = false
/** @type {Function} */
let anim = func => func()

if (typeof document !== 'undefined') {
  // Bind to the window on purpose: `const raf = window.requestAnimationFrame; raf(cb)` throws
  // "Illegal invocation" in real browsers while happy-dom tolerates the detached call.
  anim = window.requestAnimationFrame.bind(window)
}

/** Set runner other than the default requestAnimationFrame
 *
 * @param {Function} animFunc
 */
export function setAnimFunction(animFunc) {
  anim = animFunc
}

/** Schedule to run batch on the next animation frame (default runner is requestAnimationFrame)
 *
 * @param {Function} callback
 */
export function callAnim(callback) {
  anim(callback)
}

/** Add callback to the next batch, or run now if `isRunning==true` (the batch is running alreaday)
 *
 * @param {Function} callback to add
 * @returns {void}
 */
export function runInBatch(callback) {
  if (callback instanceof Array) {
    callback.forEach(runInBatch)
    return
  }
  requireFunc(callback)

  if (isRunning) {
    callback()
  } else {
    dirty.add(callback)
    if (dirty.size === 1) callAnim(runDirty)
  }
}

/** Run all of the callback that need to execute the change notification (have dirty values)
 *
 */
export function runDirty() {
  isRunning = true
  try {
    dirty.forEach(f => runFunc(f))
    dirty.clear()
  } finally {
    isRunning = false
  }
}

export function signal2Attribute(node, attr, $signal) {
  const attrUpdater = () => {
    setAttribute(node, attr, $signal())
  }
  attrUpdater.node = node
  attrUpdater.attr = attr
  observeNow($signal, () => runInBatch(attrUpdater))
  return attrUpdater
}

export function signal2Text(node, $signal) {
  const textUpdater = () => {
    node.textContent = $signal()
  }
  textUpdater.node = node
  observeNow($signal, () => runInBatch(textUpdater))
  return textUpdater
}

/** Is a value a DOM node? (duck typed: `instanceof Node` fails across frames/iframes)
 *
 * @param {any} obj
 * @returns {boolean}
 */
const isNode = obj => obj?.nodeType !== undefined

/**
 *  - [null,undefined,false] will remove the attribute
 *  - false will set value to be attrName
 *
 * This is the canonical implementation for the family (plan/improvement-plan.md P3-1);
 * `@jsx6/jsx6` re-exports it.
 *
 * @param {any} node DOM node, or a component/object exposing the node on its `el` property
 * @param {String} attrName attribute name
 * @param {any} newValue
 */
export function setAttribute(node, attrName, newValue) {
  if (newValue === false || newValue === undefined) newValue = null
  if (newValue === true) newValue = attrName
  if (!isNode(node) && isNode(node?.el)) node = node.el
  if (node.getAttribute(attrName) !== newValue) {
    if (newValue === null) {
      node.removeAttribute(attrName)
    } else {
      node.setAttribute(attrName, newValue)
    }
  }
}

function requireFunc(f, what = 'callback') {
  // JSX6E7 mirrors @jsx6/jsx6's error registry ("Function required"). The code is spelled out
  // rather than imported so this package keeps depending only on @jsx6/signal.
  if (typeof f !== 'function') throw new Error(`JSX6E7 function required for ${what}`)
}

/** Run the callback and log the error instead of breaking the rest of the batch
 *
 * @param {Function} f function to run
 * @param {Array<any>} [args] arguments for the function
 */
function runFunc(f, args = []) {
  try {
    f(...args)
  } catch (e) {
    console.error(e, f, args)
  }
}
