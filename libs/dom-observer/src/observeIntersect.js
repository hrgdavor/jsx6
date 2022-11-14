import { makeObserverHandler } from './makeObserverHandler.js'

const oberverMapBrowser = new Map()
const observerSymbol = Symbol('observeIntersect')

/** Utility to handle observing intersection events. Reason for having this is that
 * observer calling back to js has performace overhead so it is preferred to reuse them.
 *
 * https://github.com/w3ctag/design-principles/issues/78
 *
 * @param {Node} el - DOM node to observe
 * @param {Function} callback observer
 * @returns {Function} a function that removes the observer
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
