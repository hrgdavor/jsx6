import { makeObserverHandler } from './makeObserverHandler.js'

/** Utility to handle observing resize events. Reason for having this is that
 * observer calling back to js has performace overhead so it is preferred to reuse them.
 *
 * https://github.com/w3ctag/design-principles/issues/78
 *
 * @param {Node} el - DOM node to observe
 * @param {Function} callback observer
 * @returns {Function} a function that removes the observer
 */
export const observeResize = (el, callback) => handler.observe(el, callback)

const handler = makeObserverHandler('ResizeObserver')
handler.observer = new ResizeObserver(handler)
