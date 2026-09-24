import { isStr, isFunc, isObj, throwErr, Group, isNode, isArray, errorMessage } from './core.js'
import { setAttribute } from './setAttribute.js'

import {
  JSX6E10_CONTEXT_REQUIRED,
  JSX6E9_LISTENER_MUST_BE_FUNC,
  JSX6E1_NULL_TAG,
  JSX6E2_UNSUPPORTED_TAG,
  JSX6E8_REQUIRE_PARENT,
  JSX6E15_MULTIPLE_VERSIONS,
} from './errorCodes.js'
import { toDomNode } from './toDomNode.js'
import { remove } from './remove.js'

import { observeNow } from '@jsx6/signal'
import { directives } from './directives.js'
import { addDisposer } from './dispose.js'

// P2-1 stage 1: `disposeNode` is the public entry point that releases the bindings collected by
// insertAttr / directives / nodeFromObservable. It is re-exported here (jsx2dom.js is the module
// that creates the nodes and is already re-exported by index.js) and from this module only:
// two `export *` of the same name from index.js would make the name ambiguous and drop it.
export { addDisposer, disposeNode, jsxDisposeSymbol } from './dispose.js'

let markerSymbol = Symbol.for('jsx2dom_marker')
let scopeSymbol = Symbol.for('jsx2dom_scope')
if (globalThis[markerSymbol]) console.warn(errorMessage(JSX6E15_MULTIPLE_VERSIONS), globalThis[markerSymbol])
globalThis[markerSymbol] = new Error('marker')
export const getScope = () => globalThis[scopeSymbol]
const setScope = s => (globalThis[scopeSymbol] = s)

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
  let oncreate = attr?.oncreate
  if (oncreate) delete attr.oncreate
  let out

  if (isStr(tag)) {
    out = factories.Element(tag)
    insertAttr(attr, out)
    insert(out, children)
  } else {
    if (isFunc(tag)) {
      const { p } = attr

      // SCOPE is used to set properties where tags have `p` attribute
      // we must remove it while inside a child component execution to avoid accidental
      // overwrite of parent's properties by tags with `p` attribute inside child component
      // that does not define own scope
      const parent = getScope()
      let innerScope = {}
      try {
        setScope(innerScope)
        if (tag.prototype) {
          out = new tag(attr, children, parent)
        } else {
          out = tag(attr, children, innerScope, parent)
        }
        if (p) setPropGroup(parent, out, p)
      } finally {
        setScope(parent)
      }
    } else if (isNode(tag)) {
      // if the value is already a HTML element, we just return it, no need for processing
      out = tag
    } else if (isObj(tag)) {
      out = nodeFromObservable(tag) || throwErr(JSX6E2_UNSUPPORTED_TAG, tag)
    } else {
      // not sure what else to enable if tag is type of object
      // this may be expanded in the future to allow more capabilities
      throwErr(JSX6E2_UNSUPPORTED_TAG, tag)
    }
  }
  if (oncreate) {
    if (isArray(oncreate)) {
      oncreate.forEach(f => f(out, getScope()))
    } else {
      oncreate(out, getScope())
    }
  }
  return out
}

export const hSvg = (tag, attr, ...children) => {
  const out = factories.Svg(tag)
  insertAttr(attr, out)
  children.forEach(c => insert(out, c))
  return out
}

export function nodeFromObservable(obj) {
  const textNode = factories.Text('')
  const out = [textNode]
  const updater = r => {
    if (r instanceof Array && r.length === 1) r = r[0]

    let node = toDomNode(r)
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

    if (isFunc(node)) node = node(parent)

    if (isNode(node)) {
      updateTextNode(textNode, '')
      if (parent) insert(parent, node, textNode)
      out.length = 2
      out[0] = node
      out[1] = textNode
    } else if (r instanceof Array) {
      updateTextNode(textNode, '')
      if (parent) r = insert(parent, r, textNode)
      out.length = r.length
      for (let i = 0; i < r.length; i++) out[i] = r[i]
      out.push(textNode)
    } else {
      updateTextNode(textNode, factories.TextValue(r))
    }
  }
  // The text node is the anchor that stays in the DOM for the whole life of this binding
  // (it is also used as the insert `before` reference), so it owns the unsubscribe function.
  addDisposer(textNode, observeNow(obj, updater))
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
  const old = getScope()
  try {
    setScope(scope)
    return f(h)
  } finally {
    setScope(old)
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
  if (!self) self = getScope()
  for (let a in attr) {
    let value = attr[a]

    if (a[0] === 'o' && a[1] === 'n') {
      if (isFunc(value)) {
        const eventName = a.substring(2).toLowerCase()
        // keep the bound listener so teardown can remove exactly this one
        const listener = value.bind(self)
        out.addEventListener(eventName, listener)
        if (typeof out.removeEventListener === 'function') {
          // the listener keeps `self` and the element alive, so it is part of node teardown
          addDisposer(out, () => out.removeEventListener(eventName, listener))
        }
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
      let directive = directives[a]
      if (directive) {
        directive(out, a, value, self)
        value = null
      }
    } else if (a === 'p') {
      setPropGroup(self, component || out, value)
    }

    if (value !== undefined) {
      if (isFunc(value)) {
        let updater = makeAttrUpdater(out, a, value)
        // `observeNow` returns the unsubscribe function; keep it on the node so `disposeNode()`
        // can release it (undefined for static values, which addDisposer tolerates)
        addDisposer(out, observeNow(value, updater))
      } else if (out.setAttribute) {
        setAttribute(out, a, value)
      }
    }
  }
}

function setPropGroup(self, part, path) {
  // allow p attribute to be signal or callback for catching reference to the element
  if (isFunc(path)) {
    return path(part)
  }
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
  /** @type {any} nodeFromObservable returns a single-node array, but a single node is used when possible */
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

/**
 * Insert `newChild` into `parent`, optionally before the `before` node.
 *
 * `before` carries a `= undefined` default purely for TypeScript 7: it reduces a function's call
 * arity only for a default value in the signature (a JSDoc `[before]` bracket is not enough), so
 * without it every two-argument call in the workspace — the common case — is reported as an arity
 * error. The default is behaviour-preserving, since omitted and explicitly-`undefined` already had
 * to mean the same thing here (`before` is only ever passed through to `insertBefore`).
 *
 * @param {any} parent parent node (or anything `toDomNode` can convert)
 * @param {any} newChild child to insert; `null`/`undefined` and arrays are handled here
 * @param {any} [before] optional reference node to insert before
 * @returns {any} the inserted node, or an array of them when `newChild` is an array
 */
export function insert(parent, newChild, before = undefined) {
  if (newChild === undefined || newChild === null) return
  if (!parent) throwErr(JSX6E8_REQUIRE_PARENT, { parent, newChild, before })

  if (newChild instanceof Array) {
    return newChild.map(c => insert(parent, c, before))
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
  return _newChild
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
  factories = { ...factoriesDefaults, ...func(factories) }
}
