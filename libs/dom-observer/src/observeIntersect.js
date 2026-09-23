import { makeObserverHandler } from './makeObserverHandler.js'

/** @type {Map<string, import('./makeObserverHandler.js').ObserverHandler>} */
const oberverMapBrowser = new Map()
const observerSymbol = Symbol('observeIntersect')

/**
 * Intersection roots are used as cache keys, so the map of shared observers is stored
 * directly on the root under {@link observerSymbol}.
 *
 * @typedef {(Element | Document) & { [observerSymbol]?: Map<string, import('./makeObserverHandler.js').ObserverHandler> }} ObserverRoot
 */

/**
 * @typedef {Object} ObserveIntersectOptions
 * @property {ObserverRoot} [root] - the intersection root, also used to share observers between callers
 * @property {string} [rootMargin] - margin around the root
 * @property {number | number[]} [threshold] - intersection ratios at which the callback is invoked
 * @property {number} [detail] - when no `threshold` is given, granularity used to build one
 */

/** Utility to handle observing intersection events. Reason for having this is that
 * observer calling back to js has performace overhead so it is preferred to reuse them.
 *
 * https://github.com/w3ctag/design-principles/issues/78
 *
 * @param {Element} el - DOM element to observe
 * @param {Function} callback observer
 * @param {ObserveIntersectOptions} [options] observer
 * @returns {() => void} a function that removes the observer
 */
export function observeIntersect(el, callback, { root, rootMargin, threshold, detail } = {}) {
  if (!threshold && detail && typeof detail === 'number') {
    threshold = [0]
    for (let i = detail; i < 1; i += detail) {
      threshold.push(i)
    }
    threshold.push(1)
  }

  const key = JSON.stringify({ rootMargin, threshold })
  /** @type {Map<string, import('./makeObserverHandler.js').ObserverHandler>} */
  let observerMap
  if (root) {
    observerMap = root[observerSymbol] = root[observerSymbol] || new Map()
  } else {
    observerMap = oberverMapBrowser
  }

  let handler = observerMap.get(key)

  if (!handler) {
    handler = makeObserverHandler('IntersectionObserver')
    const observer = new IntersectionObserver(handler, { root, rootMargin, threshold })
    handler.observer = observer
    observerMap.set(key, handler)
  }

  return handler.observe(el, callback)
}
