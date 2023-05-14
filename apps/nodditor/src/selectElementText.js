export const selectElementText = el => {
  let range = document.createRange()
  range.selectNodeContents(el)
  let sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}
