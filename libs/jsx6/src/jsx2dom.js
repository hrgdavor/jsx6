import { isStr, isFunc, isObj, throwErr, Group, isNode, NOT } from './core.js'
import { setAttribute } from './setAttribute.js'

import {
  ERR_CONTEXT_REQUIRED,
  ERR_LISTENER_MUST_BE_FUNC,
  ERR_NULL_TAG,
  ERR_STATE_UPDATE_OBJECT_REQ,
  ERR_UNSUPPORTED_TAG,
} from './errorCodes.js'
import { toDomNode } from './toDomNode.js'
import { tryObserve } from './observe.js'
import { remove } from './remove.js'
import { $S } from './combineState.js'

let SCOPE
let DUMP_STACK = false
export const getScope = () => SCOPE

/** Short but pretty usable support function for JSX.
 *
 * @param {String|Function} tag
 * @param {Object} attr
 * @param  {...any} children
 * @returns {Element}
 */
export function h(tag, attr, ...children) {
  if (!tag) return children // supoprt for jsx fragment (esbuild: --jsx-fragment=null)

  if (isStr(tag)) {
    const out = factories.Element(tag)
    // if (DUMP_STACK) {
    out.createStack = new Error('createStack')
    DUMP_STACK = false
    // }
    insertAttr(attr, out, SCOPE)
    children.forEach(c => insert(out, c))
    return out
  } else {
    if (isFunc(tag)) {
      // declaring default value for attr in receiving function does not help because jsx tranformer would give us null here
      // const MyFuncComponent = ({title='',...attr}={}, children)=>....
      // so we will clean the value here  to avoid runtime errors and users need not worry
      // const MyFuncComponent = ({title='',...attr}, children)=>......
      // leaving attr == null might have some benefit in easier knowing when there were no attributes
      // but the downsides are far greater in usability for most cases
      attr = attr || {}
      const { p } = attr

      // SCOPE is used to set properties where tags have `p` attribute
      // we must remove it while inside a child component execution to avoid accidental
      // overwrite of parent's properties by tags with `p` attribute inside child component
      // that does not define own scope
      const parent = SCOPE
      try {
        let out
        if (tag.prototype) {
          SCOPE = undefined
          out = new tag(attr, children, parent)
        } else {
          SCOPE = {}
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
      return nodeFromObservable(tag) || throwErr(ERR_UNSUPPORTED_TAG, tag)
    } else {
      // not sure what else to enable if tag is type of object
      // this may be expanded in the future to allow more capabilities
      throwErr(ERR_UNSUPPORTED_TAG, tag)
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
  if (obj && tryObserve(obj, updater)) return out
}

function updateTextNode(node, text) {
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
  const oldStack = DUMP_STACK
  try {
    SCOPE = scope
    DUMP_STACK = true
    return f(h)
  } finally {
    SCOPE = old
    DUMP_STACK = oldStack
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

/*
need to update
 - attrib
 - node - only text for now
need to refresh the value
 - call the function to recalc
 - add the updater as listener for changes (state change, etc)
 - default is change handler of the parent component
*/
export const makeUpdater = (parent, before, attr, func) => factories.Updater(parent, before, attr, func)

function Updater(parent, before, attr, obj) {
  let updater
  if (obj.makeUpdater) {
    updater = obj.makeUpdater(parent, before, attr, obj)
  } else {
    if (attr) {
      updater = factories.AttrUpdater(parent, attr, obj)
    } else {
      updater = factories.NodeUpdater(parent, obj)
    }

    if (!tryObserve(obj, updater)) {
      throwErr(ERR_STATE_UPDATE_OBJECT_REQ, obj)
    }
  }
}

export const makeNodeUpdater = (node, func) => factories.NodeUpdater(node, func)
const NodeUpdater = (node, func) => {
  const out = () => {
    const newValue = factories.TextValue(func())
    if (node.textContent !== newValue) node.textContent = newValue
  }
  out.node = node
  return out
}

export const makeAttrUpdater = (node, attr, func) => factories.AttrUpdater(node, attr, func)

const AttrUpdater = (node, attr, func) => {
  const out = () => {
    setAttribute(node, attr, func())
  }
  out.node = node
  out.attr = attr
  out.func = func
  out() // set initial value for the attribute
  return out
}

export function insertAttr(attr, out, self, component) {
  if (!attr) return

  for (const a in attr) {
    const value = attr[a]

    if (a[0] === 'o' && a[1] === 'n') {
      if (isFunc(value)) {
        out.addEventListener(a.substring(2), value.bind(self))
      } else {
        throwErr(ERR_LISTENER_MUST_BE_FUNC, attr)
      }
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
    } else if (isFunc(value)) {
      if (a[0] === 'x' && a[1] === '-') {
        let code = a.substring(2)
        if (code == 'if') {
          a = 'hidden'
          value = $S(NOT, value)
        }
      }
      factories.Updater(out, null, a, value)
    } else {
      if (a[0] === 'x' && a[1] === '-') {
        let code = a.substring(2)
        if (code == 'if') {
          a = 'hidden'
          value = !value
        }
      }
      if (a === 'p') {
        setPropGroup(self, component || out, value)
      }
      if (out.setAttribute) {
        setAttribute(out, a, a === 'p' && value instanceof Array ? value.join('.') : value)
      }
    }
  }
}

function setPropGroup(self, part, path) {
  if (isStr(path)) path = path.split('.')
  const [$group, $key] = path
  if (self === undefined) throw throwErr(ERR_CONTEXT_REQUIRED)
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
    if (!newChild) debugger
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
  const _parent = parent.insertBefore ? parent : toDomNode(parent)

  if (!_parent.insertBefore) console.error('missing insertBefore', _parent, parent)
  let _newChild
  try {
    if (newChild?.__init) {
      newChild.__init(parent)
    }
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

let factories = {
  AttrUpdater,
  NodeUpdater,
  Updater,
  TextValue,
  Text: t => document.createTextNode(t),
  Svg: t => (t ? document.createElementNS('http://www.w3.org/2000/svg', t) : throwErr(ERR_NULL_TAG)),
  Html: (t, o) => (t ? document.createElement(t, o) : throwErr(ERR_NULL_TAG)),
  Element: (t, o) => factories.Html(t, o),
}
const factoriesDefaults = factories

export function changeFactories(func) {
  factories = { ...factoriesDefaults, ...(func(factories) || {}) }
}
