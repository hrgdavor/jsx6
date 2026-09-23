/**
 * Registers a contextmenu listener that marks the DOM elements created from JSX with their source location.
 *
 * @param {HTMLElement} [root] element the listener is registered on
 */
export function activateJsxInspector(root = globalThis?.document?.body) {
  root?.addEventListener('contextmenu', e => {
    if (!e.ctrlKey && !e.shiftKey) return
    // the listener is registered on a DOM root, so the event target is the element the user clicked
    /** @type {Element} */
    let target = /** @type {Element} */ (e.target)
    addJsxSrcAttribute(target.getRootNode())
    addJsxSrcAttribute(findShadowRoot(target))
    if (!e.ctrlKey) return
    while (target && !target.hasAttribute?.('_src')) target = /** @type {Element} */ (target.parentNode)
    if (target) {
      let root = globalThis.JSX_SRC_ROOT
      if (root) {
        window.open('vscode://file/' + root + '/' + target.getAttribute('_src'))
      }
      console.log('target', target)
    }
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
