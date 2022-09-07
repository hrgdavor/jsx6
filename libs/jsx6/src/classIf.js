/** Shortcut utility
 *
 * @param {Node} node
 * @param {String} cname
 * @param {booelan} bool decides if class is added or removed
 */

import { toDomNode } from './toDomNode.js'

export function classIf(node, cname, bool) {
  node = toDomNode(node)
  const cl = node.classList
  if (bool) {
    cl.add(cname)
  } else {
    cl.remove(cname)
  }
}
