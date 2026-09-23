import { observeIntersect } from './observeIntersect.js'

const visibleThreshold = [0, 0.0001]

/**
 * @param {Element} el - DOM element to observe
 * @param {Function} callback observer
 * @param {import('./observeIntersect.js').ObserveIntersectOptions} [options] observer
 * @returns {() => void} a function that removes the observer
 */
export function observeShowHide(el, callback, { root, rootMargin, threshold = visibleThreshold } = {}) {
  return observeIntersect(el, callback, { root, rootMargin, threshold })
}

/**
 * @param {Element} el - DOM element to observe
 * @param {Function} callback observer, called once the element becomes visible
 * @param {import('./observeIntersect.js').ObserveIntersectOptions} [options] observer
 */
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
