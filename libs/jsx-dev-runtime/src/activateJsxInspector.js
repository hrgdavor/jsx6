export function activateJsxInspector() {
  let body = document.body
  body.addEventListener('contextmenu', e => {
    if (!e.ctrlKey) return
    addAttribute(body)
  })
}

function addAttribute(el) {
  if (!el) return
  let src = el._source
  if (src) {
    el.setAttribute('_src', `${src.fileName}:${src.lineNumber}:${src.columnNumber}`)
  }
  let ch = el.firstElementChild
  while (ch) {
    addAttribute(ch)
    ch = ch.nextElementSibling
  }
}
