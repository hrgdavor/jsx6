import { observeIntersect } from './observeIntersect.js'

const visibleThreshold = [0, 0.0001]

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
