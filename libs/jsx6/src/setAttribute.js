import { isNode } from './core.js'

/**
 *  - [null,undefined,false] will remove the attribute
 *  - false will set value to be attrName
 * @param {Node} node
 * @param {String} attrName attribute name
 * @param {any} newValue
 */
export function setAttribute(node, attrName, newValue) {
  if (newValue === false || newValue === undefined) newValue = null
  if (newValue === true) newValue = attrName
  if (!isNode(node) && isNode(node.el)) node = node.el
  if (node.getAttribute(attrName) !== newValue) {
    if (newValue === null) {
      node.removeAttribute(attrName)
    } else {
      node.setAttribute(attrName, newValue)
    }
  }
}
