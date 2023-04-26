/** Fire a custom event with detail. https://developer.mozilla.org/en-US/docs/Web/Events/Creating_and_triggering_events
 *
 * @param {Element} el
 * @param {String} name
 * @param {Object} detail
 */
export const fireCustom = (el, name, detail) => {
  el.dispatchEvent(new CustomEvent(name, { detail }))
}

/** Listen to event similar to addEventListener, but with different parameters for the callback.
 * First parameter is details object, and event is second parameter.
 * This is useful for cases when we are most interested in detail object, or want to simply expand parts of it.
 *
 * @param {*} el
 * @param {*} name
 * @param {*} callback
 * @param {*} options
 * @returns {Function} that removes the listener upon call
 */
export const listenCustom = (el, name, callback, options) => {
  const cb = e => callback(e.detail || {}, e)
  el.addEventListener(name, cb, options)
  return function () {
    el.removeEventListener(cb, options)
  }
}

export const fireGlobal = (name, detail) => fireCustom(self, name, detail)

export const listenGlobal = (name, callback, options) => listenCustom(self, name, callback, options)
