import { toDomNode } from './toDomNode.js'

export function replace(newChild, oldChild, alsoDestroy) {
  const _oldChild = toDomNode(oldChild)
  const _newChild = toDomNode(newChild)
  _oldChild.parentNode.replaceChild(_newChild, _oldChild)
  if (alsoDestroy) destroy(oldChild)
  return newChild
}
