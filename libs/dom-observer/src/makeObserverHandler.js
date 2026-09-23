/** The handler manages observing and calling the appropriate callback.
 * It implements a function that removes a callback, and does unobserve whne tehere are no more callbacks.
 */

/**
 * Options object forwarded unchanged to the attached observer. The handler never inspects
 * it, so it is typed as the union of the options accepted by the supported observers.
 *
 * @typedef {IntersectionObserverInit | ResizeObserverOptions} ObserverOptions
 */

/**
 * The part of an `IntersectionObserver`/`ResizeObserver` used by the handler. The concrete
 * observer is created by the caller, so only the members shared by both are typed here.
 *
 * @typedef {Object} AttachedObserver
 * @property {(el: Element, options?: ObserverOptions) => void} observe
 * @property {(el: Element) => void} unobserve
 */

/**
 * The callable handler returned by {@link makeObserverHandler}: it receives observer entries
 * and additionally carries its `observe` method and - once the caller created it - the
 * concrete `observer` which is shared by all callbacks registered for the same options.
 *
 * @typedef {((entries: Array<IntersectionObserverEntry | ResizeObserverEntry>) => void) & {
 *   observe: (el: Element, callback: Function, options?: ObserverOptions) => (() => void),
 *   observer?: AttachedObserver,
 * }} ObserverHandler
 */

/** @param {string} name @returns {ObserverHandler} */
export const makeObserverHandler = name => {
  /** @type {WeakMap<Element, Array<Function | undefined>>} */
  const listenMap = new WeakMap()

  /** @type {ObserverHandler} */
  const listener = /** @type {ObserverHandler} */ (entries => {
    entries.forEach(entry => {
      listenMap.get(entry.target)?.forEach(fn => {
        try {
          if (fn) fn(entry)
        } catch (e) {
          console.error(`problem calling ${name} listener:  ${e.message}`, fn, e)
        }
      })
    })
  })

  listener.observe = (el, callback, options) => {
    const observer = listener.observer

    let arr = listenMap.get(el)

    if (!arr) {
      observer.observe(el, options)
      listenMap.set(el, (arr = []))
    }

    arr.push(callback)

    return () => {
      let arr = listenMap.get(el)
      if (arr) {
        let count = arr.length
        let countLeft = 0

        for (let i = 0; i < count; i++) {
          if (arr[i] === callback) arr[i] = undefined
          if (arr[i]) countLeft++
        }

        if (!countLeft) {
          listenMap.delete(el)
          observer.unobserve(el)
        }
      }
    }
  }

  return listener
}
