import { makeObserverHandler } from './makeObserverHandler.js'

/**
 * @typedef ResizeObserverOptions
 * @param {string} box - content-box (the default), border-box, device-pixel-content-box
 */

/** Utility to handle observing resize events. Reason for having this is that
 * observer calling back to js has performace overhead so it is preferred to reuse them.
 *
 * https://github.com/w3ctag/design-principles/issues/78
 *
 * @param {Node} el - DOM node to observe
 * @param {Function} callback observer
 * @param {ResizeObserverOptions} options observer
 * @returns {Function} a function that removes the observer
 */
export const observeResize = (el, callback, options) => handler.observe(el, callback, options)

const handler = makeObserverHandler('ResizeObserver')
handler.observer = new ResizeObserver(handler)
