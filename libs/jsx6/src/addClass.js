/** Shortcut utility
 *
 * @param {Node} node
 * @param {String|Array<String>} add class names
 */

import { isArray } from './core.js'
import { toDomNode } from './toDomNode.js'

export function addClass(node, add) {
  node = toDomNode(node)
  if (add.includes(' ')) add = add.split(' ')
  const cl = node.classList
  if (isArray(add)) add.forEach(c => cl.add(c))
  else cl.add(add)
}
