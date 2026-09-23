import { makeObserverHandler } from './makeObserverHandler.js'

/**
 * Options for {@link observeResize}, matching the DOM `ResizeObserverOptions`.
 *
 * @typedef {Object} ResizeObserverOptions
 * @property {ResizeObserverBoxOptions} [box] - content-box (the default), border-box, device-pixel-content-box
 */

/** Utility to handle observing resize events. Reason for having this is that
 * observer calling back to js has performace overhead so it is preferred to reuse them.
 *
 * https://github.com/w3ctag/design-principles/issues/78
 *
 * @param {Element} el - DOM element to observe
 * @param {Function} callback observer
 * @param {ResizeObserverOptions} [options] observer
 * @returns {() => void} a function that removes the observer
 */
export const observeResize = (el, callback, options) => handler.observe(el, callback, options)

/** @type {import('./makeObserverHandler.js').ObserverHandler} */
const handler = makeObserverHandler('ResizeObserver')
handler.observer = new ResizeObserver(handler)
