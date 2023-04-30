export function activateJsxInspector() {
  let body = document.body
  body.addEventListener('contextmenu', e => {
    if (!e.ctrlKey) return
    addAttribute(e.target.getRootNode())
    addAttribute(findShadowRoot(e.target))
  })
}

globalThis.activateJsxInspector = activateJsxInspector

function addAttribute(el) {
  if (!el) return
  let src = el._source
  if (src) {
    if (el.hasAttribute('_src')) return
    el.setAttribute('_src', `${src.fileName}:${src.lineNumber}:${src.columnNumber}`)
  }
  let ch = el.firstElementChild
  while (ch) {
    addAttribute(ch)
    ch = ch.nextElementSibling
  }
}

function findShadowRoot(element) {
  if (element instanceof ShadowRoot) return element
  if (element.shadowRoot) return element.shadowRoot
  if (!element.parentNode) return null
  return findShadowRoot(element.parentNode)
}
