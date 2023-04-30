import { h, isNode } from '@jsx6/jsx6'
import { activateJsxInspector } from './src/activateJsxInspector'

function jsxDEV(tag, { children, ...attr }, key, isStatic, source) {
  let out = h(tag, attr, children)
  if (isNode(out)) out._source = source
  return out
}

function jsx(tag, { children, ...attr }) {
  return h(tag, attr, children)
}

// it will be called via jsx function, and there we extract children from first age and
// provide as second arg
var Fragment = (attr, children) => children

activateJsxInspector()

export { jsx, jsx as jsxs, jsxDEV, Fragment }
