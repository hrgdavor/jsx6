import { isStr, isFunc, isObj, throwErr, Group, isNode, NOT, isArray, requireFunc } from './core.js'
import { setAttribute } from './setAttribute.js'

import {
  JSX6E10_CONTEXT_REQUIRED,
  JSX6E9_LISTENER_MUST_BE_FUNC,
  JSX6E13_NOT_OBSERVABLE,
  JSX6E1_NULL_TAG,
  JSX6E2_UNSUPPORTED_TAG,
} from './errorCodes.js'
import { toDomNode } from './toDomNode.js'
import { remove } from './remove.js'

import { observeValue, $NOT, asSignal } from '@jsx6/signal'
import { observe, signal, signalValue } from '../../signal/dist/index.js'
import { outputFilterSymbol, setValue } from './setValue.js'
import { getValue, inputFilterSymbol } from './getValue.js'
let SCOPE
export const getScope = () => SCOPE

const directives = {}
export function addDirective(key, directive) {
  directives[key] = directive
}
export const getDirective = key => directives[key]

addDirective('x-if', (el, a, $signal, self) => {
  let updater = () => setAttribute(el, 'hidden', !$signal())
  updater(observeValue($signal, updater))
})

addDirective('x-value', (el, a, $signal, self) => {
  let updater = v => setValue(el, v)
  updater(observeValue($signal, updater))
  el.addEventListener('input', e => $signal(getValue(el)))
})

addDirective('x-filter', (el, a, filters, self) => {
  if (isArray(filters)) {
    el[inputFilterSymbol] = requireFunc(filters[0])
    el[outputFilterSymbol] = requireFunc(filters[1])
  } else {
    el[inputFilterSymbol] = requireFunc(filters)
  }
})

/** Short but pretty usable support function for old JSX before jsx-runtime.
 *
 * @param {String|Function} tag
 * @param {Object} attr
 * @param  Array<any>} children
 * @returns {Element}
 */
export function h(tag, attr, ...children) {
  // in old jsx, attr is null when no attributes are provided
  return toDom(tag, attr || {}, children)
}

export function toDom(tag, attr, children) {
  if (!tag) return children // supoprt for jsx fragment (esbuild: --jsx-fragment=null)

  if (isStr(tag)) {
    const out = factories.Element(tag)
    insertAttr(attr, out, SCOPE)
    insert(out, children)
    return out
  } else {
    if (isFunc(tag)) {
      const { p } = attr

      // SCOPE is used to set properties where tags have `p` attribute
      // we must remove it while inside a child component execution to avoid accidental
      // overwrite of parent's properties by tags with `p` attribute inside child component
      // that does not define own scope
      const parent = SCOPE
      try {
        let out
        SCOPE = {}
        if (tag.prototype) {
          out = new tag(attr, children, parent)
        } else {
          out = tag(attr, children, SCOPE, parent)
        }
        if (p) setPropGroup(parent, out, p)
        return out
      } finally {
        SCOPE = parent
      }
    } else if (isNode(tag)) {
      // if the value is already a HTML element, we just return it, no need for processing
      return tag
    } else if (isObj(tag)) {
      return nodeFromObservable(tag) || throwErr(JSX6E2_UNSUPPORTED_TAG, tag)
    } else {
      // not sure what else to enable if tag is type of object
      // this may be expanded in the future to allow more capabilities
      throwErr(JSX6E2_UNSUPPORTED_TAG, tag)
    }
  }
}

export const hSvg = (tag, attr, ...children) => {
  const out = factories.Svg(tag)
  insertAttr(attr, out, SCOPE)
  children.forEach(c => insert(out, c))
  return out
}

export function nodeFromObservable(obj) {
  const textNode = factories.Text('')
  const out = [textNode]
  let first = null
  const updater = r => {
    if (r instanceof Array && r.length === 1) r = r[0]

    const node = toDomNode(r)
    const parent = textNode.parentNode

    if (parent) {
      while (out.length > 1) {
        const toRemove = out.shift()
        remove(toRemove)
      }
    } else if (out.length > 1) {
      out.length = 1
      out[0] = textNode
    }

    if (isNode(node)) {
      updateTextNode(textNode, '')
      if (parent) insert(parent, node, textNode)
      out.length = 2
      out[0] = node
      out[1] = textNode
    } else if (r instanceof Array) {
      updateTextNode(textNode, '')
      if (parent) insert(parent, r, textNode)
      out.length = r.length
      for (let i = 0; i < r.length; i++) out[i] = r[i]
      out.push(textNode)
    } else {
      updateTextNode(textNode, factories.TextValue(r))
    }
  }
  updater(observeValue(obj, updater))
  return out
}

export function updateTextNode(node, text) {
  if (node.textContent !== text) node.textContent = text
}

/** Enable creating html elements with option to assign parts to properties on the provided scope object.
 * Adding attribute `p` to an element `<div p="searchBox"` will cause generator to
 * assign the created element to `scope.searchBox`
 *
 * Callback must expose the first parameter exactly like this: `domWithScope(scope,h=><b>Bla</b>)`
 * so that generated JS form JSX will use that scoped function
 *
 * @param {Object} scope object that will receive references to parts of the content
 * @param {Function} f callback inside which te html needs to be created
 * @returns
 */
export function domWithScope(scope, f) {
  const old = SCOPE
  try {
    SCOPE = scope
    return f(h)
  } finally {
    SCOPE = old
  }
}
export function domToProps(f) {
  const scope = {}
  f(h.bind(scope))
  return scope
}

/** Temporarily force creating svg elements instead of html elements
 * (creating a SVG tag with html namespace will fail to produce svg on screen)
 *
 * @param {Function} callback inside which the SVG JSX needsto be executed
 * @returns
 */
export const svg = callback => {
  const creator = factories.Element
  try {
    factories.Element = factories.Svg
    return callback(h)
  } finally {
    factories.Element = creator
  }
}

/** Function to standardize how textValue is generated
 *
 * @param {any} v
 * @returns
 */
export const textValue = v => factories.TextValue(v)
const TextValue = v => {
  if (v === null || v === undefined) return ''
  if (!isStr(v)) return '' + v
  return v
}

export const makeAttrUpdater = (node, attr, func) => {
  const out = () => {
    setAttribute(node, attr, func())
  }
  out.node = node
  out.attr = attr
  out.func = func
  return out
}

export function insertAttr(attr, out, self, component) {
  if (!attr) return
  if (!self) self = SCOPE

  for (let a in attr) {
    let value = attr[a]

    if (a[0] === 'o' && a[1] === 'n') {
      if (isFunc(value)) {
        out.addEventListener(a.substring(2), value.bind(self))
      } else {
        throwErr(JSX6E9_LISTENER_MUST_BE_FUNC, attr)
      }
      value = undefined
    } else if (a === 'key') {
      out.loopKey = value
      if (!out.$key) {
        out.$key = value
      }
      if (component) {
        if (!component.$key) {
          component.$key = value
        }
        component.loopKey = value
      }
    } else if (a[0] === 'x') {
      directives[a]?.(out, a, value, self)
    } else if (a === 'p') {
      setPropGroup(self, component || out, value)
    }

    if (value !== undefined) {
      if (isFunc(value)) {
        makeAttrUpdater(out, a, value)
      } else if (out.setAttribute) {
        setAttribute(out, a, value)
      }
    }
  }
}

function setPropGroup(self, part, path) {
  if (isStr(path)) path = path.split('.')
  const [$group, $key] = path
  if (self === undefined) throw throwErr(JSX6E10_CONTEXT_REQUIRED)
  if ($key) {
    if (!self[$group]) self[$group] = new Group()
    self[(part.$group = $group)][(part.$key = $key)] = part
  } else {
    self[(part.$key = $group)] = part
  }
}

const forInsertFuncObj = newChild => {
  let maybe = nodeFromObservable(newChild)
  if (maybe?.length === 1) maybe = maybe[0]
  return maybe || factories.Text(factories.TextValue(newChild))
}

export function forInsert(newChild) {
  if (newChild instanceof Array) {
    return newChild.map(c => forInsert(c))
  }
  if (isFunc(newChild)) {
    newChild = forInsertFuncObj(newChild)
  } else if (!isNode(newChild)) {
    if (isNode(newChild.el)) {
      newChild = newChild.el
    } else {
      newChild = forInsertFuncObj(newChild)
    }
  }
  return newChild
}

export function insert(parent, newChild, before, _self) {
  if (newChild === undefined || newChild === null) return
  if (!parent) throwErr(ERR_REQUIRE_PARENT, { parent, newChild, before })

  if (newChild instanceof Array) {
    return newChild.map(c => insert(parent, c, before, _self))
  }

  const _parent = parent.insertBefore ? parent : toDomNode(parent)

  if (!_parent.insertBefore) console.error('missing insertBefore', _parent, parent)
  let _newChild
  try {
    _newChild = forInsert(newChild)
    if (_newChild instanceof Array) {
      _newChild.forEach(c => _parent.insertBefore(c, toDomNode(before)))
    } else {
      _parent.insertBefore(_newChild, toDomNode(before))
    }
  } catch (error) {
    console.error('parent', parent, 'newChild', newChild, 'before', before, 'forInsert', _newChild)
    throw error
  }
  return newChild
}

export const addToBody = n => insert(document.body, n)
export const addToHead = n => insert(document.head, n)

export let factories = {
  TextValue,
  Text: t => document.createTextNode(t),
  Svg: t => (t ? document.createElementNS('http://www.w3.org/2000/svg', t) : throwErr(JSX6E1_NULL_TAG)),
  Html: (t, o) => (t ? document.createElement(t, o) : throwErr(JSX6E1_NULL_TAG)),
  Element: (t, o) => factories.Html(t, o),
}
const factoriesDefaults = factories

export function changeFactories(func) {
  factories = { ...factoriesDefaults, ...(func(factories) || {}) }
}
