import { h } from '@jsx6/jsx6'

function jsx(tag, { children = [], ...attr }) {
  return h(tag, attr, ...children)
}
// it will be called via jsx function, and there we extract children from first arg and
// provide as second arg
// example: jsx(Fragment, {children:[]})
var Fragment = (attr, ...children) => children

export { jsx, jsx as jsxs, Fragment }
