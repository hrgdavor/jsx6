import { throwErr, ERR_REQUIRE_PARENT } from './core'
import { toDomNode } from './toDomNode'

export function insertBefore(parent, newChild, before) {
  if (!parent) throwErr(ERR_REQUIRE_PARENT, { parent, newChild, before })
  const _parent = parent.insertBefore ? parent : toDomNode(parent)

  if (!_parent.insertBefore) console.error('missing insertBefore', _parent, parent)
  if (newChild.__init) {
    newChild.__init(parent)
  }
  try {
    let _newChild = toDomNode(newChild)
    if (_newChild instanceof Array) _newChild = _newChild[0]
    _parent.insertBefore(_newChild, toDomNode(before))
  } catch (error) {
    console.error('parent', parent, 'newChild', newChild, 'before', before)
    throw error
  }
  return newChild
}

export const appendChild = insertBefore

export function replaceChild(parent, newChild, before) {
  insertBefore(parent, newChild, before)
  removeChild(parent, before)
  return newChild
}

export function removeChild(parent, child) {
  const _parent = parent.removeChild ? parent : toDomNode(parent)
  try {
    // if (_child instanceof Array) _child = _child[0]
    _parent.removeChild(toDomNode(child))
  } catch (error) {
    console.error('parent', parent, 'newChild', newChild, 'before', before)
    throw error
  }
}
