import { h } from '@jsx6/jsx6'

const Fragment = ({ children }) => children

function jsx(tag, { children, ...attr }) {
  return h(tag, attr, children)
}

export { jsx, jsx as jsxs, Fragment }
