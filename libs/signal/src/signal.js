/**
 *  @template T
 *  @typedef {function():T|boolean} Signal
 *
 * @typedef {Object} SignalDef
 * @prop {function(T):T} $signal
 * @prop {function():void} fireChanged
 * @prop {Array<Function>} listeners
 * @prop {function(T):boolean} setValue
 *
 */

import { subscribeSymbol, triggerSymbol } from './observe.js'

export const ValueSymbol = Symbol.for('signalValue')

/**
 * @template T
 * @param {T|undefined} value
 * @returns {function():T|boolean} signal
 */
export function signal(value) {
  return prepareSignal(value).$signal
}

/**
 * @function
 * @template T
 *
 * @param {T} value
 * @returns {SignalDef<T>}
 */
export function prepareSignal(value) {
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

  const fireChanged = () => {
    for (let listener of listeners) listener(value)
  }

  $signal[subscribeSymbol] = u => listeners.add(u)
  $signal[triggerSymbol] = fireChanged
  $signal[Symbol.toPrimitive] = () => value

  return { $signal, fireChanged, listeners, setValue }
}
