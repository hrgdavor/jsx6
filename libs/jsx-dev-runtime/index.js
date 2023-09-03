import { h, isNode, isArray } from '@jsx6/jsx6'
import { activateJsxInspector } from './src/activateJsxInspector'

function jsxDEV(tag, { children = [], ...attr }, key, isStatic, source) {
  try {
    if (children && !isArray(children)) children = [children]
    let out = h(tag, attr, ...children)
    if (isNode(out)) out._source = source
    return out
  } catch (e) {
    console.log(
      'ERROR while creating DOM from JSX\n' +
        e.message +
        '\n  at: JSX (' +
        source.fileName +
        ':' +
        source.lineNumber +
        ':' +
        source.columnNumber +
        ')\n',
    )
    console.log('tag:', tag)
    console.log('attributes:', attr)
    console.log('children:', children)
    throw e
  }
}

function jsx(tag, { children, ...attr }) {
  return h(tag, attr, ...children)
}

// it will be called via jsx function, and there we extract children from first arg and
// provide as second arg
var Fragment = (attr, ...children) => children

activateJsxInspector()

export { jsx, jsx as jsxs, jsxDEV, Fragment }
