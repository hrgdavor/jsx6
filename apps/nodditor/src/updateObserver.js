/**
 *
 * @param {Set<Element>} newSet
 * @param {Set<Element>} oldSet
 * @param {ResizeObserver} observer
 */
export function updateObserver(newSet, oldSet, observer) {
  // observe/unobserve
  let removed = new Set()
  newSet.forEach(el => {
    if (!oldSet.has(el)) {
      observer.observe(el)
    }
  })
  oldSet.forEach(el => {
    if (!newSet.has(el)) {
      observer.unobserve(el)
      removed.add(el)
    }
  })
  return removed
}
