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

export function insert(parent, child, before) {
  if (child instanceof Array) {
    child.forEach(c => insert(parent, c))
  } else {
    if (typeof child === 'string') child = document.createTextNode(child)
    parent.insertBefore(child, before)
  }
}
