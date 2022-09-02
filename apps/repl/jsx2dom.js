/** Short but pretty usable support function for JSX.
 *
 * @param {String|Function} tag
 * @param {Object} attr
 * @param  {...any} children
 * @returns {Element}
 */
export function h(tag, attr, ...children) {
  if (!tag) return children // support JSX fragment: <></>
  const node = document.createElement(tag)
  if (attr) {
    for (let aName in attr) {
      const value = attr[aName]
      if (value !== false && value !== null && value !== undefined) {
        if (aName.startsWith('on') && typeof value === 'function') {
          node.addEventListener(aName.substring(2), value)
        } else {
          node.setAttribute(aName, value)
        }
      }
    }
  }
  children.forEach(c => insert(node, c))
  return node
}

/** Utility function to replace usage of Node.appendChild and Node.insertBefore.
 * Supports child to also be
 *  - Array<Node>  - to streamline JSX.Fragment usage.
 *  - String - to simplify inserting text
 *
 * @param {Node} parent - parent node where child Nodes are added
 * @param {String|Node|Array<Node>} child String will be converted to TextNode, and array will cause all items to be added from the array
 * @param {Node|null} before optional Node to insert before instead the default (append)
 */
export function insert(parent, child, before) {
  if (child instanceof Array) {
    child.forEach(c => insert(parent, c))
  } else {
    if (child === null || child === undefined) return
    if (!(child instanceof Node)) {
      if (typeof child !== 'string') child += ''
      child = document.createTextNode(child)
    }
    parent.insertBefore(child, before)
  }
}

/** A common use case for this tutorial is to add elements to document.body.
 *
 * @param {Node} child
 * @returns
 */
export const addToBody = child => insert(document.body, child)

/** Common use case when we are adding content to some part of a page.
 *
 * @param {Node|String} parent reference to dom node or css selector
 * @param {String|Node|Array<Node>} child
 */
export function replace(parent, child) {
  if (typeof parent === 'string') parent = document.querySelector(parent)
  const parentNode = parent.parentNode

  if (child instanceof Array) {
    // first insert them in front of the node we are replacing
    insert(parent.parentNode, child, parent)
    // then just remove it
    parentNode.removeChild(parent)
  } else {
    parentNode.replaceChild(child, parent)
  }
}
