import { toDomNode } from './toDomNode.js'

export function findParent(el, filter, stopFilter) {
  let p = toDomNode(el)

  if (typeof filter === 'string') {
    let tagName = filter
    filter = p => p.tagName === tagName
  }

  while (p) {
    if (stopFilter && stopFilter(p)) break
    if (filter(p)) return p
    p = p.parentNode
  }
}
