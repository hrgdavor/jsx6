import { toDom, isNode } from '@jsx6/jsx6'
import { activateJsxInspector } from './src/activateJsxInspector.js'

function jsxDEV(tag, { children, ...attr } = {}, key, isStatic, source) {
  try {
    if (tag === Fragment) return children

    let out = toDom(tag, attr, children)
    if (isNode(out)) out._source = source
    return out
  } catch (e) {
    console.log(
      'ERROR while creating DOM from JSX\n' +
        e.message +
        '\n  at: JSX (' +
        source?.fileName +
        ':' +
        source?.lineNumber +
        ':' +
        source?.columnNumber +
        ')\n',
    )
    console.log('tag:', tag)
    console.log('attributes:', attr)
    console.log('children:', children)
    throw e
  }
}

// will not be called, we intercept the reference and return children in jsxDEV
var Fragment = (attr, children) => children

activateJsxInspector()

export { jsxDEV, Fragment }
