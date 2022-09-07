import { throwErr, ERR_REQUIRE_PARENT, isFunc } from './core.js'
import { makeUpdater, textValue } from './insertHtml.js'
import { toDomNode } from './toDomNode.js'

export function insert(parent, newChild, before, _self) {
  if (newChild instanceof Array) {
    return newChild.map(c => insert(parent, c, before, _self))
  }
  if (!parent) throwErr(ERR_REQUIRE_PARENT, { parent, newChild, before })
  const _parent = parent.insertBefore ? parent : toDomNode(parent)

  if (!_parent.insertBefore) console.error('missing insertBefore', _parent, parent)
  if (newChild.__init) {
    newChild.__init(parent)
  }
  try {
    let _newChild = toDomNode(newChild)
    if (_newChild instanceof Array) _newChild = _newChild[0]

    if (!(_newChild instanceof Node)) {
      if (isFunc(_newChild)) {
        const func = _newChild
        // todo move into inserthtml to access _createTextNode
        _newChild = document.createTextNode(textValue(func()))
        makeUpdater(_newChild, before, null, func, _self)
      } else {
        if (typeof _newChild !== 'string') _newChild += ''
        _newChild = newChild = document.createTextNode(_newChild)
      }
    }

    _parent.insertBefore(_newChild, toDomNode(before))
  } catch (error) {
    console.error('parent', parent, 'newChild', newChild, 'before', before)
    throw error
  }
  return newChild
}

export const addToBody = n => insert(document.body, n)
