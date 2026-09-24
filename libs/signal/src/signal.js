/**
 * A signal is a function that returns its current value when called without arguments,
 * and sets a new value when called with one (returning true when the value changed).
 *
 * @template T
 * @typedef {(value?: T) => T|boolean|undefined} Signal
 */

/**
 * Internals of the callable signal created by prepareSignal
 *
 * @template T
 * @typedef {Object} SignalDef
 * @prop {Signal<T>} $signal
 * @prop {() => void} fireChanged
 * @prop {Set<Function>} listeners
 * @prop {(T) => boolean|undefined} setValue
 *
 */

import { isObservable, subscribeSymbol, triggerSymbol } from './observe.js'
import { trackState } from './track.js'
import { attachTrace, captureFrom, signalsTraced } from './trace.js'

export const ValueSymbol = Symbol.for('signalValue')
const noOp = function () {}

/**
 * @template T
 * @param {T|undefined} value
 * @param {string} [name]
 * @returns {Signal<T>} signal
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
 * @param {T} [value]
 * @param {string} [name]
 * @returns {SignalDef<T>}
 */
export function prepareSignal(value, name) {
  const listeners = new Set()
  // Captured here, at the top of the factory, so the first non-library frame really is the caller.
  // One `new Error()` per *named* signal, and only while tracing; every anonymous signal and every
  // signal created with tracing off short-circuits on the boolean. Computeds take the other branch
  // (they attach their own record, with the getter, in `src/computed.js`).
  const origin = name && signalsTraced ? captureFrom(new Error().stack) : null

  function setValue(v) {
    if (v === value) return
    value = v
    return true
  }

  const $signal = (...args) => {
    // getter
    if (args.length === 0) {
      // #region read-hook
      // Dependency-tracking hook, inlined on purpose: one monomorphic property read on the hot path,
      // and nothing else while no computed is evaluating.
      const collector = trackState.collector
      if (collector !== null) collector.add($signal)
      // #endregion read-hook
      return value
    }

    // setter
    if (setValue(args[0])) {
      fireChanged()
      return true
    }
  }

  Object.defineProperty($signal, ValueSymbol, { get: $signal }) // allows getting velue in Chrome dev tools
  // Console inspection: expanding a signal in the dev console shows its current value next to a `value`
  // label. The getter *is* the signal, so the value is read when the console expands the object, not
  // when it was logged — that is the point (a snapshot would be stale by the time you look at it), and
  // it is why `$signal()` remains the way to log a value at a specific moment. Non-enumerable, so it
  // stays out of Object.keys, spread, `for...in` and JSON, and `value` is never a supported read in
  // application code.
  Object.defineProperty($signal, 'value', { get: $signal, configurable: true })
  if (name) {
    $signal.label = name
    Object.defineProperty($signal, 'name', { value: name })
  }

  const fireChanged = () => {
    // for (let listener of listeners) listener()
    listeners.forEach(runFuncNoArg)
  }

  $signal[subscribeSymbol] = u => {
    // Was `!u && typeof u != 'function'`, which only rejected undefined/null listeners and let
    // any other non-function through to `listeners.add` (plan/improvement-plan.md P2-5).
    if (typeof u != 'function') throw 'listener must be a function'
    listeners.add(u)
    return () => listeners.delete(u)
  }
  $signal[triggerSymbol] = fireChanged
  $signal[Symbol.toPrimitive] = $signal.get = () => value

  // The tracing record: the creation site and the live listener set, attached only while tracing and
  // only to named signals. `listeners` is handed over by reference on purpose — a debugger wants to
  // see subscribers arrive and leave, not a snapshot from creation time.
  if (origin) attachTrace($signal, { kind: 'signal', listeners, origin })

  return { $signal, fireChanged, listeners, setValue }
}

export const runFuncNoArg = f => {
  try {
    f()
  } catch (e) {
    console.error(e, f)
  }
}
