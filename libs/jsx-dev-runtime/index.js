import { h, isNode } from '@jsx6/jsx6'
import { activateJsxInspector } from './src/activateJsxInspector'

const Fragment = ({ children }) => children

function jsxDEV(tag, { children, ...attr }, key, isStatic, source) {
  let out = h(tag, attr, children)
  if (isNode(out)) out._source = source
  return out
}

function jsx(tag, { children, ...attr }) {
  return h(tag, attr, children)
}

activateJsxInspector()

export { jsx, jsx as jsxs, jsxDEV, Fragment }
