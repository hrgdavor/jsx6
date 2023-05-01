export function activateJsxInspector() {
  let body = document.body
  body.addEventListener('contextmenu', e => {
    if (!e.ctrlKey) return
    addJsxSrcAttribute(e.target.getRootNode())
    addJsxSrcAttribute(findShadowRoot(e.target))
  })
}

function addJsxSrcAttribute(el) {
  if (!el) return
  let src = el._source
  if (src) {
    if (el.hasAttribute('_src')) return
    el.setAttribute('_src', `${src.fileName}:${src.lineNumber}:${src.columnNumber}`)
  }
  let ch = el.firstElementChild
  while (ch) {
    addJsxSrcAttribute(ch)
    ch = ch.nextElementSibling
  }
}

function findShadowRoot(element) {
  if (element instanceof ShadowRoot) return element
  if (element.shadowRoot) return element.shadowRoot
  if (!element.parentNode) return null
  return findShadowRoot(element.parentNode)
}

globalThis.activateJsxInspector = activateJsxInspector
globalThis.addJsxSrcAttribute = addJsxSrcAttribute
