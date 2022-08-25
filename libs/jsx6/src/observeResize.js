import { toDomNode } from './toDomNode'

const listenMap = new WeakMap()

/** Utility to handle observing resize events. Reason for having this is that
 * observer calling back to js has performace overhead so it is preferred to reuse them.
 *
 * https://github.com/w3ctag/design-principles/issues/78
 *
 * @param {Node} el - DOM node to observe
 * @param {Function} callback observer
 * @returns {Function} a function that removes the observer
 */
export function observeResize(el, callback) {
  el = toDomNode(el)
  let arr = listenMap.get(el)

  if (!arr) {
    listenMap.set(el, (arr = []))
  }

  if (!arr.length) observer.observe(el)
  arr.push(callback)

  // function that removes the observer
  return function () {
    const arr = listenMap.get(el)
    if (arr) {
      listenMap.set(el, (arr = arr.filter(f => f !== callback)))
    }
    if (!arr?.length) observer.unobserve(el)
  }
}

const observer = (observeResize.observer = new ResizeObserver(entries => {
  entries.forEach(entry => {
    listenMap.get(entry.target)?.forEach(fn => {
      try {
        fn(entry)
      } catch (e) {
        console.error('problem calling ResizeObserver listener: ' + e.message, fn, e)
      }
    })
  })
}))
