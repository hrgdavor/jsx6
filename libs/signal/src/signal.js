/**
 *  @template T
 *  @typedef {function():T|boolean} Signal
 *
 * @typedef {Object} SignalDef
 * @prop {function(T):T} $signal
 * @prop {function():void} fireChanged
 * @prop {Set<Function>} listeners
 * @prop {function(T):boolean} setValue
 *
 */

import { isObservable, subscribeSymbol, triggerSymbol } from './observe.js'

export const ValueSymbol = Symbol.for('signalValue')
const noOp = function () {}
/**
 * @template T
 * @param {T|undefined} value
 * @param {string} [name]
 * @returns {function():T|boolean} signal
 */
export function signal(value, name) {
  return prepareSignal(value, name).$signal
}

export function staticSignal(obj) {
  let $signal = () => obj
  $signal[subscribeSymbol] = noOp
  $signal[triggerSymbol] = noOp
  $signal[Symbol.toPrimitive] = $signal.get = $signal
  return $signal
}


export function asSignal(obj) {
  if (obj?.[subscribeSymbol]) return obj
  if (!obj) return staticSignal(obj)

  if (isObservable(obj)) {
    let { $signal, listeners } = prepareSignal()
    const isPromise = typeof obj.then === 'function'
    const callback = v => {
      $signal(v)
      if (isPromise) {
        listeners.clear()
      }
    }
    if (isPromise) {
      obj.then(callback)
    } else {
      obj.subscribe(callback)
    }
    return $signal
  } else {
    return staticSignal(obj)
  }
}

/**
 * @function
 * @template T
 *
 * @param {T} value
 * @param {string} [name]
 * @returns {SignalDef<T>}
 */
export function prepareSignal(value, name) {
  const listeners = new Set()

  function setValue(v) {
    if (v === value) return
    value = v
    return true
  }

  const $signal = (...args) => {
    // getter
    if (args.length === 0) return value

    // setter
    if (setValue(args[0])) {
      fireChanged()
      return true
    }
  }

  Object.defineProperty($signal, ValueSymbol, { get: $signal }) // allows getting velue in Chrome dev tools
  if (name) {
    $signal.label = name
    Object.defineProperty($signal, 'name', { value: name })
  }

  const fireChanged = () => {
    // for (let listener of listeners) listener()
    listeners.forEach(runFuncNoArg)
  }

  $signal[subscribeSymbol] = u => {
    if (!u && typeof u != 'function') throw 'listener must be a function'
    listeners.add(u)
    return () => listeners.delete(u)
  }
  $signal[triggerSymbol] = fireChanged
  $signal[Symbol.toPrimitive] = $signal.get = () => value

  return { $signal, fireChanged, listeners, setValue }
}

export const runFuncNoArg = f => {
  try {
    f()
  } catch (e) {
    console.error(e, f)
  }
}
