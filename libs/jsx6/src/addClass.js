import { isArray, isObj } from './core.js'
import { toDomNode } from './toDomNode.js'

/** Shortcut utility
 *
 * @param {Node|Object} node
 * @param {String|Array<String>} add class names
 */
export function addClass(node, add) {
  node = toDomNode(node) || {}
  let cl = node.classList
  if (cl) {
    if (add.includes(' ')) add = add.split(' ')
    if (isArray(add)) add.forEach(c => cl.add(c))
    else cl.add(add)
  } else if (isObj(node)) {
    cl = node['class'] || ''
    node['class'] = cl ? cl + ' ' + add : add
  }
  return node
}
