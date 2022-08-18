import { transform as babelTransform, availablePlugins } from '@babel/standalone'
import jsx_mi2 from 'babel-plugin-jsx-simple'
import syntax_jsx from 'babel-plugin-syntax-jsx'
import { preventInfiniteLoops } from './preventInfiniteLoops'
console.log(jsx_mi2.toString())
availablePlugins['jsx-mi2'] = jsx_mi2
availablePlugins['syntax-jsx'] = syntax_jsx
availablePlugins['preventInfiniteLoops'] = preventInfiniteLoops

export const transformDefaults = {
  retainLines: true,
  plugins: ['syntax-jsx', 'jsx-mi2', 'syntax-object-rest-spread', 'preventInfiniteLoops'],
  presets: [],
}

export function transform(code, options = {}, append = {}) {
  const op = {
    ...transformDefaults,
    ...options,
  }
  for (let p in append) {
    if (append[p] instanceof Array) op[p] = [...op[p], ...append[p]]
    else op[p] = { ...op[p], ...append[p] }
  }
  return babelTransform(code, op)
}
