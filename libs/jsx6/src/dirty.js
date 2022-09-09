import { runFunc, throwErr, isObj, requireFunc, isFunc } from './core.js'
import { ERR_DIRTY_RECURSION, ERR_DIRTY_RUNNER_FUNC } from './errorCodes.js'

const dirty = new Set()
let hasDirty = false
let isRunning = false
let anim = func => func()

if (typeof document !== 'undefined') {
  anim = window.requestAnimationFrame
}

export function setAnimFunction(animFunc) {
  anim = animFunc
}

export function callAnim(callback) {
  anim(callback)
}

export function eq(...args) {
  if (args.length > 1) {
    return value(args[0]) === value(args[1])
  }
  return other => value(args[0]) === value(other)
}

export function value(v) {
  return v && isFunc(v) ? v() : v
}
export function addDirty(func) {
  // TDOD check if it is better to just run the udpater immediately
  // if infinite recusrions, will cause stackoverflow, and that is ok, can be easily traced and fixed
  // if (isRunning) throwErr(ERR_DIRTY_RECURSION)
  if (func instanceof Array) {
    func.forEach(addDirty)
    return
  }
  requireFunc(func, ERR_DIRTY_RUNNER_FUNC)

  // TDOD check if it is better to just run the udpater immediately
  if (isRunning) {
    // unlike throwing error, running immediately during update (it is animation frame already)
    // will likely be more performant, and easier to catch errors with stackoverflow
    func()
  } else {
    dirty.add(func)
    if (!hasDirty) {
      // once first dirty is marked, request animation frame, but only once
      hasDirty = true
      callAnim(runDirty)
    }
  }
}

export function runDirty() {
  isRunning = true
  try {
    dirty.forEach(f => runFunc(f))
    dirty.clear()
    hasDirty = false
  } finally {
    isRunning = false
  }
}

function runUpdaters(updaters, args) {
  updaters.forEach(u => u(...args))
}

export function makeBinding(initialValue, propName, obj, alsoSetBindProp) {
  const updaters = []
  let value = initialValue

  function bindingFunc(v) {
    if (isFunc(v)) {
      return asBinding(() => v(value), obj, propName, updaters)
    }
    if (arguments.length) updateValue(value)
    return value
  }

  const binding = asBinding(bindingFunc, obj, propName, updaters)
  const updateValue = v => {
    if (v !== value) {
      value = v
      binding.dirty()
    }
  }

  if (obj) {
    Object.defineProperty(obj, propName, {
      get: () => value,
      set: updateValue,
    })
  }

  if (obj && alsoSetBindProp) obj['$' + propName] = bindingFunc

  return binding
}

function asBinding(func, state, prop, updaters) {
  func.isBinding = true
  func.update = f => (state[prop] = f(state[prop]()))
  func.addUpdater = u => updaters.push(v => u(func(v)))
  func.sync = f => {
    f(state[prop]())
    updaters.push(() => f(state[prop]()))
  }
  func.dirty = () => {
    if (updaters.length) addDirty(() => runUpdaters(updaters, [state[prop]]))
  }
  func.state = state
  func.propName = prop
  return func
}

export function makeState(_state = {}, markDirtyNow) {
  const updaters = []
  const perPropUpdaters = {}
  const perPropUpdaterRunner = {}
  const bindings = {}
  const lastData = new Map()

  function runUpdaters() {
    const len = updaters.length
    for (let i = 0; i < len; i++) {
      try {
        updaters[i](bindingsProxy, lastData, state)
      } catch (error) {
        console.error(error)
      }
    }
    lastData.clear()
  }

  function _addDirty() {
    if (updaters.length) addDirty(runUpdaters)
  }

  const handler = {
    set: function (target, prop, value, receiver) {
      if (updateProp(prop, value)) _addDirty()
      return true
    },
    get: function (target, prop) {
      return _state[prop]
    },
  }

  const state = new Proxy(_state, handler)
  const bindingsProxy = new Proxy(bindingFunc, {
    set: function (target, prop, value, receiver) {
      if (updateProp(prop, value)) _addDirty()
      return true
    },
    get: function (target, prop) {
      if (prop === 'toJSON') return () => _state
      if (prop === Symbol.iterator) return all[Symbol.iterator].bind(all)

      if (!bindings[prop]) {
        perPropUpdaters[prop] = []
        perPropUpdaterRunner[prop] = () => perPropUpdaters[prop].forEach(f => runFunc(f, [_state[prop]]))
        const func = function (value) {
          if (arguments.length !== 0) {
            if (isFunc(value)) {
              return filterFunc(value)
            }
            if (updateProp(prop, value)) _addDirty()
          }
          return _state[prop]
        }
        const filterFunc = filter =>
          asBinding(() => filter(_state[prop]), bindingsProxy, prop, perPropUpdaters[prop])
        func.get = func.set = func.toString = func
        bindings[prop] = asBinding(func, bindingsProxy, prop, perPropUpdaters[prop])
      }
      return bindings[prop]
    },
  })
  const all = [bindingsProxy, state, _state]

  function bindingFunc(f) {
    if (!arguments.length) {
      return $
    } else if (isFunc(f)) {
      const out = () => f(_state)
      out.addUpdater = updater => updaters.push(requireFunc(updater, ERR_DIRTY_RUNNER_FUNC))
      return out
    } else if (isObj(f)) {
      $.update(f)
    } else {
      // todo chekc if there is even a use-case
      // _addDirty()
      return f
    }
  }

  function updateProp(p, value, force) {
    if (force || _state[p] !== value) {
      lastData.set(p, _state[p])
      _state[p] = value
      if (perPropUpdaters[p]) addDirty(perPropUpdaterRunner[p])
      return true
    }
    return false
  }

  function $() {
    return state
  }
  Object.defineProperty($, 'value', {
    get: $,
  })
  $.toJSON = () => _state
  $.push = $.addUpdater = updater => updaters.push(updater)
  $.dirty = _addDirty
  $.getValue = () => ({ ..._state })
  $.list = updaters
  $.update = (newData, force) => {
    if (!newData) return
    let changed = false
    for (const p in newData) {
      changed |= updateProp(p, newData[p], force)
    }
    if (changed) _addDirty()
  }
  $.replace = (newData, force) => {
    if (!newData) return
    let changed = false
    for (const p in newData) {
      changed |= updateProp(p, newData[p], force)
    }
    for (const p in _state) {
      if (!(p in newData)) {
        changed |= updateProp(p, undefined, force)
      }
    }
    if (changed) _addDirty()
  }

  if (markDirtyNow) _addDirty()

  return bindingsProxy
}
