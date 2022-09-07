import { destroy } from './destroy.js'
import { toDomNode } from './toDomNode.js'

export function remove(child, alsoDestroy) {
  try {
    const _child = toDomNode(child)
    const parent = _child.parentNode
    parent.removeChild(_child)
    if (alsoDestroy) destroy(child)
  } catch (error) {
    console.error('parent', parent, 'child', child)
    throw error
  }
}
