import { toDomNode } from './toDomNode.js'
import { insert } from './jsx2dom.js'

export function replace(newChild, oldChild, alsoDestroy) {
  const _oldChild = toDomNode(oldChild)
  const _newChild = toDomNode(newChild)
  _oldChild.parentNode.replaceChild(_newChild, _oldChild)
  return newChild
}

export function replaceContent(parent, newChild, alsoDestroy) {
  const _parent = toDomNode(parent)
  _parent.innerHTML = ''

  insert(_parent, newChild)
  return newChild
}
