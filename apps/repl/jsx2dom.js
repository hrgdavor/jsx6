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
    for (let key in attr) {
      const value = attr[key]
      if (value !== false && value !== null && value !== undefined) node.setAttribute(key, value)
    }
  }
  if (children?.length) insert(node, children)
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
    if (!(child instanceof Node)) child = document.createTextNode(child + '')
    parent.insertBefore(child, before)
  }
}
