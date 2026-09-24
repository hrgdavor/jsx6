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
 * `observe` takes `any` for its options on purpose: the handler forwards them untouched and
 * never inspects them, and the two concrete observers take unrelated option types. Typing them
 * as the `ObserverOptions` union makes the assignment in `observeResize.js` a parameter
 * contravariance error under TypeScript 7 (which checks method assignability more strictly).
 *
 * @typedef {Object} AttachedObserver
 * @property {(el: Element, options?: any) => void} observe
 * @property {(el: Element) => void} unobserve
 */

/**
 * The callable handler returned by {@link makeObserverHandler}: it receives observer entries
 * and additionally carries its `observe` method and - once the caller created it - the
 * concrete `observer` which is shared by all callbacks registered for the same options.
 *
 * @typedef {((entries: Array<IntersectionObserverEntry | ResizeObserverEntry>) => void) & {
 *   observe: (el: Element, callback: Function, options?: ObserverOptions) => (() => void),
 *   observer: AttachedObserver,
 * }} ObserverHandler
 */

/** @param {string} name @returns {ObserverHandler} */
export const makeObserverHandler = name => {
  /** @type {WeakMap<Element, Array<Function | undefined>>} */
  const listenMap = new WeakMap()

  /** @type {ObserverHandler} */
  const listener = /** @type {ObserverHandler} */ (
    entries => {
      entries.forEach(entry => {
        listenMap.get(entry.target)?.forEach(fn => {
          try {
            if (fn) fn(entry)
          } catch (e) {
            // TypeScript 7 types `catch` bindings as `unknown`; narrow before reading `.message`.
            const message = e instanceof Error ? e.message : String(e)
            console.error(`problem calling ${name} listener:  ${message}`, fn, e)
          }
        })
      })
    }
  )

  // The concrete observer is attached by the caller (see `observeResize.js`) and is shared by
  // every callback registered for the same options. It is dereferenced in the assert below and
  // in `observe`/the removal closure only after that assignment.
  listener.observer = /** @type {AttachedObserver} */ (/** @type {unknown} */ (undefined))

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
