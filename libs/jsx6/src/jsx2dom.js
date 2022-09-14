import { isStr, isFunc, isObj, throwErr, Group, isNode } from './core.js'
import { setAttribute } from './setAttribute.js'

import {
  ERR_CONTEXT_REQUIRED,
  ERR_LISTENER_MUST_BE_FUNC,
  ERR_NULL_TAG,
  ERR_UNSUPPORTED_TAG,
} from './errorCodes.js'
import { toDomNode } from './toDomNode.js'

let SCOPE

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
      const toObserve = def.then || def.subscribe
      if (toObserve) {
        // support for promise(.then) or observable(.next) values
        const out = factories.Text('')
        // TODO make node replacer that handles switching types of conent not just text
        // TODO make sure node is replaced if new update comes before return and is not a simpel text update on this textNode
        toObserve.call(def, r => (out.textContent = r))
        return out
      } else {
        throwErr(ERR_UNSUPPORTED_TAG, tag)
      }
    } else {
      // not sure what else to enable if tag is type of object
      // this may be expanded in the future to allow more capabilities
      throwErr(ERR_UNSUPPORTED_TAG, tag)
    }
  }
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

/*
need to update
 - attrib
 - node - only text for now
need to refresh the value
 - call the function to recalc
 - add the updater as listener for changes (state change, etc)
 - default is change handler of the parent component
*/
export const makeUpdater = (parent, before, attr, func, updaters) =>
  factories.Updater(parent, before, attr, func, updaters)

// TODO remove old concept of udpater array for components
function Updater(parent, before, attr, func, updaters) {
  if (isFunc(updaters?.state)) {
    updaters = updaters.state()
  }

  let updater
  if (func.makeUpdater) {
    updater = func.makeUpdater(parent, before, attr, func, updaters)
  } else {
    if (attr) {
      updater = factories.AttrUpdater(parent, attr, func, updaters)
    } else {
      updater = factories.NodeUpdater(parent, func)
    }

    if (func.subscribe) {
      func.subscribe(updater)
    } else {
      updaters.push(updater)
    }
  }
}

export const makeNodeUpdater = (node, func) => factories.NodeUpdater(node, func)
const NodeUpdater = (node, func) => {
  const out = () => {
    const newValue = textValue(func())
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
      factories.Updater(out, null, a, value, self)
    } else {
      if (a === 'p') {
        setPropGroup(self, component || out, value)
      }
      if (out.setAttribute)
        setAttribute(out, a, a === 'p' && value instanceof Array ? value.join('.') : value)
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

export function insert(parent, newChild, before, _self) {
  if (newChild instanceof Array) {
    return newChild.map(c => insert(parent, c, before, _self))
  }
  if (!parent) throwErr(ERR_REQUIRE_PARENT, { parent, newChild, before })
  const _parent = parent.insertBefore ? parent : toDomNode(parent)

  if (!_parent.insertBefore) console.error('missing insertBefore', _parent, parent)
  if (newChild?.__init) {
    newChild.__init(parent)
  }
  try {
    let _newChild = toDomNode(newChild)
    if (_newChild instanceof Array) _newChild = _newChild[0]

    if (!(_newChild instanceof Node)) {
      if (isFunc(_newChild)) {
        const func = _newChild
        _newChild = factories.Text(textValue(func()))
        factories.Updater(_newChild, before, null, func, _self)
      } else {
        if (typeof _newChild !== 'string') _newChild += ''
        _newChild = newChild = factories.Text(_newChild)
      }
    }

    _parent.insertBefore(_newChild, toDomNode(before))
  } catch (error) {
    console.error('parent', parent, 'newChild', newChild, 'before', before)
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
