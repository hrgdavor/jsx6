export const calcPos = (el, root) => {
  let top = 0
  let left = 0
  while (el && el != root) {
    top += el.offsetTop + el.clientTop
    left += el.offsetLeft + el.clientLeft
    el = el.offsetParent
  }
  return [left, top]
}
