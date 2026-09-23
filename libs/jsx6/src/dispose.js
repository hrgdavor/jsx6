/**
 * Node disposal / teardown for `@jsx6/jsx6` — stage 1 of P2-1 in plan/improvement-plan.md.
 * See plan/disposal-design.md for the full contract.
 *
 * Every subscription created while a node is built is pushed onto an array stored on the node
 * itself under {@link jsxDisposeSymbol}: `observeNow()` already returns an unsubscribe function,
 * and `addEventListener` needs a matching `removeEventListener`. `disposeNode()` walks a subtree
 * and releases all of them.
 *
 * Nothing in this module touches the DOM: disposal only releases bindings. Detaching nodes stays
 * the job of `remove()` / `replace()` and of native DOM calls (`el.remove()`, `removeChild`).
 */
import { toDomNode } from './toDomNode.js'

/** Symbol under which a created node keeps the list of its teardown functions.
 *
 * `Symbol.for` (not `Symbol()`) is used so that two copies of `@jsx6/jsx6` loaded in one page
 * still agree on the key — the same approach already used for `jsx2dom_marker` / `jsx2dom_scope`
 * in jsx2dom.js.
 */
export const jsxDisposeSymbol = Symbol.for('jsx6_dispose')

/**
 * Register a teardown function for a node.
 *
 * @param {any} node node that will own the teardown function (element, text node, component or array)
 * @param {Function|undefined} dispose function returned by `observeNow()`, or a listener-removal closure;
 *   `undefined` is tolerated so that observing a static (non-signal) value needs no special case
 * @returns {Function|undefined} the same function, so `addDisposer(el, observeNow(value, updater))` reads well
 */
export function addDisposer(node, dispose) {
  if (!node || typeof node !== 'object' || typeof dispose !== 'function') return dispose
  let list = node[jsxDisposeSymbol]
  if (!list) {
    list = []
    node[jsxDisposeSymbol] = list
  }
  list.push(dispose)
  return dispose
}

/** Release the teardown functions collected directly on one node.
 *
 * The list is replaced with an empty array *before* the callbacks run, which is what makes
 * `disposeNode()` idempotent and safe against re-entrancy (a disposer may dispose its own node).
 *
 * @param {any} node
 * @returns {number} how many teardown functions were released
 */
function release(node) {
  const list = node[jsxDisposeSymbol]
  if (!list || list.length === 0) return 0
  node[jsxDisposeSymbol] = []
  let count = 0
  for (const dispose of list) {
    try {
      dispose()
      count++
    } catch (error) {
      // A failing teardown must not prevent the rest of the subtree from being released.
      console.error('jsx6 dispose failed', error)
    }
  }
  return count
}

/**
 * Release every teardown function collected on `node` and on all nodes of its subtree.
 *
 * - accepts an element, a text node, a component (anything with `.el`) or an array of those;
 * - is idempotent — the second call finds nothing left to release;
 * - never throws (individual failures are logged) and never detaches anything from the DOM;
 * - descendants are released before the node itself, so a component's own `ondestroy()` hook runs
 *   after the bindings of its subtree are already gone.
 *
 * @param {any} node
 * @returns {number} how many teardown functions were released
 */
export function disposeNode(node) {
  return walkDispose(node)
}

/**
 * @param {any} node
 * @returns {number}
 */
function walkDispose(node) {
  if (!node || typeof node !== 'object') return 0

  if (node instanceof Array) {
    let count = release(node)
    for (const child of node) count += walkDispose(child)
    return count
  }

  /** @type {any} */
  const el = toDomNode(node)
  let count = 0
  if (el !== node) {
    // A component (Jsx6, Loop, …) keeps its disposers on its own element, but release the
    // wrapper too in case a custom teardown was registered directly on the component object.
    count += release(node)
  }

  if (!el || typeof el !== 'object') return count

  const children = el.childNodes
  if (children) {
    // Snapshot first: a disposer is allowed to mutate the DOM, and a live list would skip nodes.
    const snapshot = Array.from(children)
    for (const child of snapshot) count += walkDispose(child)
  }
  count += release(el)
  return count
}
