import { isNode } from './core'

export function toDomNode(n) {
  return !n || isNode(n) ? n : n.el || n
}
