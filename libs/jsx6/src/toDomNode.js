import { isNode } from './core.js'

export function toDomNode(n) {
  return !n || isNode(n) ? n : n.el || n
}
