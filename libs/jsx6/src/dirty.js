import { runFunc, throwErr, isObj, requireFunc, isFunc, isObjNN } from './core.js'
import { ERR_DIRTY_RECURSION, ERR_DIRTY_RUNNER_FUNC, ERR_STATE_UPDATE_OBJECT_REQ } from './errorCodes.js'
// TODO test and make work integration with Observable and RX
const dirty = new Set()
let hasDirty = false
let isRunning = false
let anim = func => func()

if (typeof document !== 'undefined') {
  anim = window.requestAnimationFrame
}

/** Set runner other than the default requestAnimationFrame
 *
 * @param {Function} animFunc
 */
export function setAnimFunction(animFunc) {
  anim = animFunc
}

/** Schedule to run batch on the next animation frame (default runner is requestAnimationFrame)
 *
 * @param {Function} callback
 */
export function callAnim(callback) {
  anim(callback)
}

/** Add callback to the next batch, or run now if `isRunning==true` (the batch is running alreaday)
 *
 * @param {Function} callback to add
 * @returns {void}
 */
export function addDirty(callback) {
  // TDOD check if it is better to just run the udpater immediately
  // if infinite recusrions, will cause stackoverflow, and that is ok, can be easily traced and fixed
  // if (isRunning) throwErr(ERR_DIRTY_RECURSION)
  if (callback instanceof Array) {
    callback.forEach(addDirty)
    return
  }
  requireFunc(callback, ERR_DIRTY_RUNNER_FUNC)

  // TDOD check if it is better to just run the udpater immediately
  if (isRunning) {
    // unlike throwing error, running immediately during update (it is animation frame already)
    // will likely be more performant, and easier to catch errors with stackoverflow
    callback()
  } else {
    dirty.add(callback)
    if (!hasDirty) {
      // once first dirty is marked, request animation frame, but only once
      hasDirty = true
      callAnim(runDirty)
    }
  }
}

/** Run all of the callback that need to execute the change notification (have dirty values)
 *
 */
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

/** Run a batch of updaters(listeners/subscribers) and apps specific arguments
 *
 * @param {Arra<Function>} updaters
 * @param {Array<any>} args arguments to pass to the callbacks
 */
function runUpdaters(updaters, args) {
  updaters.forEach(u => u(...args))
}

function asBinding(func, state, prop, updaters) {
  func.isBinding = true
  func.update = f => (state[prop] = f(state[prop]()))
  func.subscribe = u => updaters.push(v => u(func(v)))
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

export function makeState(rawState, markDirtyNow) {
  let isObjectState = isObjNN(rawState)

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
      return rawState[prop]
    },
  }

  const state = new Proxy(isObjectState ? rawState : {}, handler)
  const bindingsProxy = new Proxy(bindingFunc, {
    set: function (target, prop, value, receiver) {
      if (updateProp(prop, value)) _addDirty()
      return true
    },
    get: function (target, prop) {
      if (prop === 'toJSON') return () => rawState
      if (prop === Symbol.iterator) return all[Symbol.iterator].bind(all)

      if (!bindings[prop]) {
        perPropUpdaters[prop] = []
        perPropUpdaterRunner[prop] = () => {
          // it can happen that we have leftover listeners for a property when rawState was an object
          // so if currently rawState is not an object, we send out undefined
          // TODO explore f there is benefit in allowing litening to parts of primitive values (probably not)
          const newValue = isObjectState ? rawState[prop] : undefined
          perPropUpdaters[prop].forEach(f => runFunc(f, [newValue]))
        }
        const func = function (value) {
          if (arguments.length !== 0) {
            if (isFunc(value)) {
              return filterFunc(value)
            }
            if (updateProp(prop, value)) _addDirty()
          }
          return rawState[prop]
        }
        const filterFunc = filter =>
          asBinding(() => filter(rawState[prop]), bindingsProxy, prop, perPropUpdaters[prop])
        func.get = func.set = func.toString = func
        bindings[prop] = asBinding(func, bindingsProxy, prop, perPropUpdaters[prop])
      }
      return bindings[prop]
    },
  })
  const all = [bindingsProxy, state, rawState]

  function bindingFunc(f) {
    if (!arguments.length) {
      return $
    } else if (isFunc(f)) {
      const out = () => f(rawState)
      out.subscribe = updater => updaters.push(requireFunc(updater, ERR_DIRTY_RUNNER_FUNC))
      return out
    } else {
      $.set(f)
    }
  }

  function updateProp(p, value, force) {
    if (force || rawState[p] !== value) {
      lastData.set(p, rawState[p])
      rawState[p] = value
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
  $.toJSON = () => rawState
  $.push = $.subscribe = updater => updaters.push(updater)
  $.dirty = _addDirty
  $.getValue = () => (isObjectState ? { ...rawState } : rawState)
  $.list = updaters

  $.add = (newData, force) => {
    if (!newData) return
    if (typeof newData !== 'object') throwErr(ERR_STATE_UPDATE_OBJECT_REQ)

    let changed = false
    for (const p in newData) {
      changed |= updateProp(p, newData[p], force)
    }
    if (changed) _addDirty()
  }

  $.set = (_rawState, force) => {
    let changed = false
    let _isObjectState = isObjNN(_rawState)

    if (isObjectState != _isObjectState) {
      // switched type of internal raw data (object vs primitive)
      changed = true
      isObjectState = _isObjectState
      if (!isObjectState) {
        // TODO when switching from object to primitive, need to notify all keyed properties listeners of change
        for (const p in rawState) {
          if (perPropUpdaters[p]) addDirty(perPropUpdaterRunner[p])
        }
      }
    } else if (isObjectState) {
      for (const p in _rawState) {
        changed |= updateProp(p, _rawState[p], force)
      }
      for (const p in rawState) {
        if (!(p in _rawState)) {
          changed |= updateProp(p, undefined, force)
        }
      }
    } else {
      // for primitives we only need to check
      if (_rawState !== rawState) {
        changed = true
        rawState = _rawState
      }
    }

    if (changed) _addDirty()
  }

  if (markDirtyNow) _addDirty()

  return bindingsProxy
}
