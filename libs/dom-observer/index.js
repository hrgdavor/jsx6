const oberverMapBrowser = new Map()
const visibleThreshold = [0, 0.0001]
const observerSymbol = Symbol('observeIntersect')

export const makeObserverHandler = name => {
  const listenMap = new WeakMap()

  const listener = entries => {
    entries.forEach(entry => {
      listenMap.get(entry.target)?.forEach(fn => {
        try {
          if (fn) fn(entry)
        } catch (e) {
          console.error(`problem calling ${name} listener:  ${e.message}`, fn, e)
        }
      })
    })
  }

  listener.observe = (el, callback) => {
    const observer = listener.observer

    let arr = listenMap.get(el)

    if (!arr) {
      observer.observe(el)
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

export function observeShowHide(el, callback, { root, rootMargin, threshold = visibleThreshold } = {}) {
  return observeIntersect(el, callback, { root, rootMargin, threshold })
}

export function observeInit(el, callback, { root, rootMargin, threshold = visibleThreshold } = {}) {
  let remove = observeIntersect(
    el,
    evt => {
      if (evt.intersectionRatio) {
        remove()
        callback(evt)
      }
    },
    { root, rootMargin, threshold },
  )
}
