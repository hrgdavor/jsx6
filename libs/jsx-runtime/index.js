import { toDom } from '@jsx6/jsx6'

function jsx(tag, { children, ...attr }) {
  if (tag === Fragment) return children
  return toDom(tag, attr, children)
}

// will not be called, we intercept the reference and return children in jsxDEV
var Fragment = (attr, children) => children

export { jsx, jsx as jsxs, Fragment }
