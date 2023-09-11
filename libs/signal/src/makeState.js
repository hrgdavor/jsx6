import { runFunc, throwErr, isObj, requireFunc, isFunc, isObjNN } from './core.js'
import {
  JSX6E4_DIRTY_RECURSION,
  JSX6E5_DIRTY_RUNNER_FUNC,
  JSX6E11_STATE_UPDATE_OBJECT_REQ,
} from './errorCodes.js'
import { subscribeSymbol, triggerSymbol } from './observe.js'

// TODO test and make work integration with Observable and RX
const dirty = new Set()
let hasDirty = false
let isRunning = false
let anim = func => func()

export const extendValueSymbol = Symbol('addValue')

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
export function runInBatch(callback) {
  // TDOD check if it is better to just run the udpater immediately
  // if infinite recusrions, will cause stackoverflow, and that is ok, can be easily traced and fixed
  // if (isRunning) throwErr(ERR_DIRTY_RECURSION)
  if (callback instanceof Array) {
    callback.forEach(runInBatch)
    return
  }
  requireFunc(callback, JSX6E5_DIRTY_RUNNER_FUNC)

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

export function doSubscribeValue(updaters, updater, func, skipTrigger) {
  requireFunc(updater, JSX6E5_DIRTY_RUNNER_FUNC)
  doSubscribe(updaters, () => updater(func()), skipTrigger)
}

export function doSubscribe(updaters, updater, skipTrigger) {
  requireFunc(updater, JSX6E5_DIRTY_RUNNER_FUNC)
  updaters.push(updater)
  if (!skipTrigger) updater()
}

function asBinding(func, state, prop, updaters) {
  func.isBindingFunc = true

  // TODO check if needed, what is this ?
  //func.update = f => (state[prop] = f(state[prop]()))

  func[subscribeSymbol] = (u, skipTrigger) => doSubscribeValue(updaters, u, func, skipTrigger)
  func[triggerSymbol] = () => {
    if (updaters.length) runInBatch(updaters)
  }
  // TODO reimplement sync
  // func.sync = f => {
  //   doSubscribe(updaters, () => f(func()))
  // }

  // TODO reimplement dirty if needed, or remove
  // func.dirty = () => {
  //   if (updaters.length) runInBatch(updaters)
  // }
  //  func.state = state
  //  func.propName = prop
  addCommonGet(func, func)
  return func
}

/**
 * Mimics Observable RxJS
 * - toString enables state.sth ++ to work even though it is a function
 * - toJSON enables us to not worry if binding is sent to RPC or whatever else that uses JSON.stringify
 *
 * @param {Object|Function} obj
 * @param {Function} func - func that returns desired value for: toString and toJSON
 * @returns
 */
const addCommonGet = (obj, func) => (obj.toString = obj.toJSON = func)

export function makeState(rawState, returnAll) {
  let isObjectState = isObjNN(rawState)

  const updaters = []
  const perPropUpdaters = new Map()
  const perPropUpdaterRunner = new Map()
  const bindings = new Map()
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
    if (updaters.length) runInBatch(runUpdaters)
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

  // we return value proxy for objects to avoid undetected changes
  const returnRaw = () => (isObjectState ? state : rawState)

  const specialProps = new Map()
  specialProps.set('toJSON', returnRaw)
  specialProps.set('get', returnRaw)
  specialProps.set(Symbol.toPrimitive, returnRaw)

  const bindingsProxy = new Proxy(bindingFunc, {
    set: function (target, prop, value, receiver) {
      if (updateProp(prop, value)) _addDirty()
      return true
    },
    get: function (target, prop) {
      if (specialProps.has(prop)) return specialProps.get(prop)

      if (!bindings.has(prop)) {
        perPropUpdaters.set(prop, [])
        perPropUpdaterRunner.set(prop, () => {
          // it can happen that we have leftover listeners for a property when rawState was an object
          // so if currently rawState is not an object, we send out undefined
          // TODO explore f there is benefit in allowing litening to parts of primitive values (probably not)
          const newValue = isObjectState ? rawState[prop] : undefined
          perPropUpdaters.get(prop).forEach(f => runFunc(f, [newValue]))
        })
        const func = function (value) {
          if (arguments.length !== 0) {
            if (updateProp(prop, value)) _addDirty()
          }
          return rawState[prop]
        }
        addCommonGet(func, func)
        bindings.set(prop, asBinding(func, bindingsProxy, prop, perPropUpdaters.get(prop)))
      }
      return bindings.get(prop)
    },
  })

  function bindingFunc(f) {
    return arguments.length ? set(f) : returnRaw()
  }

  function updateProp(p, value, force) {
    if (force || rawState[p] !== value) {
      lastData.set(p, rawState[p])
      rawState[p] = value
      if (perPropUpdaters.has(p)) runInBatch(perPropUpdaterRunner.get(p))
      return true
    }
    return false
  }

  const subscribe = (u, skipTrigger) => doSubscribeValue(updaters, u, returnRaw, skipTrigger)

  const extend = (newData, force) => {
    if (!newData) return
    if (typeof newData !== 'object') throwErr(JSX6E11_STATE_UPDATE_OBJECT_REQ)

    let changed = false
    for (const p in newData) {
      changed |= updateProp(p, newData[p], force)
    }
    if (changed) _addDirty()
  }

  const set = (_rawState, force) => {
    let changed = false
    let _isObjectState = isObjNN(_rawState)

    if (isObjectState != _isObjectState) {
      // switched type of internal raw data (object vs primitive)
      changed = true
      isObjectState = _isObjectState
      if (!isObjectState) {
        // TODO when switching from object to primitive, need to notify all keyed properties listeners of change
        for (const p in rawState) {
          if (perPropUpdaters.has(p)) runInBatch(perPropUpdaterRunner.get(p))
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

  specialProps.set(extendValueSymbol, extend)
  specialProps.set(subscribeSymbol, subscribe)
  specialProps.set(triggerSymbol, _addDirty)

  return returnAll ? [bindingsProxy, state] : bindingsProxy
}

export function extendValue(obj, value) {
  obj[extendValueSymbol]?.(value)
}