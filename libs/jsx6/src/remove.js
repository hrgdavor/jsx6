import { toDomNode } from './toDomNode.js'

export function remove(child) {
  try {
    const _child = toDomNode(child)
    const parent = _child.parentNode
    parent.removeChild(_child)
  } catch (error) {
    console.error('parent', parent, 'child', child)
    throw error
  }
}
