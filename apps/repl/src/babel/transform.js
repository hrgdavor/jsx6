import { availablePlugins, transform as babelTransform } from '@babel/standalone'
import jsx_mi2 from 'babel-plugin-jsx-simple'
import syntax_jsx from 'babel-plugin-syntax-jsx'

import { preventInfiniteLoops } from './preventInfiniteLoops'

availablePlugins['jsx-mi2'] = jsx_mi2
availablePlugins['syntax-jsx'] = syntax_jsx
availablePlugins['preventInfiniteLoops'] = preventInfiniteLoops

export const transformDefaults = {
  retainLines: true,
  plugins: ['syntax-jsx', 'jsx-mi2', 'syntax-object-rest-spread', 'preventInfiniteLoops'],
  presets: [],
}

function combineAppend(options = {}, append = {}) {
  for (let p in append) {
    if (options[p]) {
      if (append[p] instanceof Array) options[p] = [...options[p], ...append[p]]
      else options[p] = { ...options[p], ...append[p] }
    } else {
      options[p] = append[p]
    }
  }
}

export function transform(code, options = {}, append = {}) {
  const op = {
    ...transformDefaults,
    ...options,
  }
  combineAppend(op, append)
  return babelTransform(code, op)
}

export const transformcjs = (code, options = {}, append = {}) => {
  options = { sourceMaps: 'inline', ...options }
  combineAppend(append, { plugins: ['transform-modules-commonjs'] })
  return transform(code, options, append)
}
