import { toDomNode } from './toDomNode.js'
import { insert } from './jsx2dom.js'
import { disposeNode } from './dispose.js'

/**
 * P2-1 stage 2: the replaced / cleared children are disposed automatically.
 *
 * `alsoDestroy` was accepted but ignored before; it now means "dispose the old content"
 * and defaults to true. Pass `false` to keep the old child's bindings alive when it is
 * going to be re-inserted somewhere else.
 *
 * @param {any} newChild
 * @param {any} oldChild
 * @param {boolean} [alsoDestroy]
 */
export function replace(newChild, oldChild, alsoDestroy) {
  const _oldChild = toDomNode(oldChild)
  const _newChild = toDomNode(newChild)
  if (alsoDestroy !== false) disposeNode(_oldChild)
  _oldChild.parentNode.replaceChild(_newChild, _oldChild)
  return newChild
}

/** @param {any} parent @param {any} newChild @param {boolean} [alsoDestroy] */
export function replaceContent(parent, newChild, alsoDestroy) {
  const _parent = toDomNode(parent)
  if (alsoDestroy !== false) {
    // `innerHTML = ''` drops the children without going through remove(), so release them here.
    for (const child of Array.from(_parent.childNodes || [])) disposeNode(child)
  }
  _parent.innerHTML = ''

  insert(_parent, newChild)
  return newChild
}
