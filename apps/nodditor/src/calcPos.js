export const calcPos = (el, root) => {
  let top = 0
  let left = 0
  while (el && el != root) {
    top += el.offsetTop
    left += el.offsetLeft
    el = el.offsetParent
  }
  return [left, top]
}
