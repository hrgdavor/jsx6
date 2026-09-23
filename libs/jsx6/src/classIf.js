import { toDomNode } from './toDomNode.js'

/** Shortcut utility
 *
 * @param {Element} node element whose class list is changed
 * @param {String} cname
 * @param {boolean} bool decides if class is added or removed
 */
export function classIf(node, cname, bool) {
  node = toDomNode(node)
  const cl = node.classList
  if (bool) {
    cl.add(cname)
  } else {
    cl.remove(cname)
  }
}
