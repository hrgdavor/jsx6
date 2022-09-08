import { isStr, isFunc, isObj, throwErr, Group, isNode } from './core.js'
import { setAttribute } from './setAttribute.js'

import {
  ERR_CONTEXT_REQUIRED,
  ERR_LISTENER_MUST_BE_FUNC,
  ERR_NULL_TAG,
  ERR_UNSUPPORTED_TAG,
} from './errorCodes.js'
import { toDomNode } from './toDomNode.js'

const NO_CONTEXT = {}

/** Short but pretty usable support function for JSX.
 *
 * @param {String|Function} tag
 * @param {Object} attr
 * @param  {...any} children
 * @returns {Element}
 */
function make(tag, attr, ...children) {
  if (!tag) return children // supoprt for jsx fragment (esbuild: --jsx-fragment=null)

  if (isStr(tag)) {
    const out = factories.Element(tag)
    insertAttr(attr, out, this)
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
      return tag.prototype ? new tag(attr, children, this) : tag(attr, children, this)
    } else if (isNode(tag)) {
      // if the value is already a HTML element, we just return it, no need for processing
      return tag
    } else if (isObj(tag)) {
      const toObserve = def.then || def.next
      if (toObserve) {
        // support for promise(.then) or observable(.next) values
        const out = factories.Text('')
        // TODO make node replacer that handles switching types of conent not just text
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

/** Short but pretty usable support function for JSX.
 *
 * @param {String|Function} tag
 * @param {Object} attr
 * @param  {...any} children
 * @returns {Element}
 */
// we bind the exported variant to a constant so it can check if property assignment is used without a context
export const h = make.bind(NO_CONTEXT)
// hack to make calling bind on already bound function possible, and actually binding to the new scope
// without this a function that is already created by .bind would keep the initial scope
h.bind = s => {
  const out = make.bind(s)
  out.bind = h.bind
  return out
}

/*
// sample code that demonstrates the binding trick above
var x = {n:'x'}, y = {n:'y'}, z = {n:'z'}
function n(){ return this.n}
var nx = n.bind(x)

// comment out next line and console.log will output: 'x x x' instead of 'x y z'
nx.bind = s=>{ let out = n.bind(s); out.bind = nx.bind; return out; }

var ny = nx.bind(y)
var nz = ny.bind(z)
console.log(nx(),ny(),nz())
*/

export function domWithScope(scope, f) {
  return f(h.bind(scope))
}
export function domToProps(f) {
  const scope = {}
  f(h.bind(scope))
  return scope
}

export const svg = callback => {
  const creator = factories.Element
  try {
    factories.Element = factories.Svg
    return callback(h)
  } finally {
    factories.Element = creator
  }
}

export function textValue(v) {
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

// TODO remove old concept of udpater for components
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

    if (func.addUpdater) {
      func.addUpdater(updater)
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
        setPropGroup(self, component || out, isStr(value) ? value.split('.') : value)
      }
      if (out.setAttribute)
        setAttribute(out, a, a === 'p' && value instanceof Array ? value.join('.') : value)
    }
  }
}

function setPropGroup(self, part, [$group, $key]) {
  if (self === NO_CONTEXT) throw throwErr(ERR_CONTEXT_REQUIRED)
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
  if (newChild.__init) {
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
  Text: t => document.createTextNode(t),
  Svg: t => (t ? document.createElementNS('http://www.w3.org/2000/svg', t) : throwErr(ERR_NULL_TAG)),
  Html: (t, o) => (t ? document.createElement(t, o) : throwErr(ERR_NULL_TAG)),
  Element: (t, o) => factories.Html(t, o),
}
const factoriesDefaults = factories

export function changeFactories(func) {
  factories = { ...factoriesDefaults, ...(func(factories) || {}) }
}
