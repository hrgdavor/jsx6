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
import { signal as alienSignal, getActiveSub as activeSub } from './alien.js'

export const ValueSymbol = Symbol.for('signalValue')
/** Internal marker: the alien-signals node backing a jsx6 signal. Enables zero-cost bridging. */
export const srcSymbol = Symbol.for('signalAlienSource')
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

  /**
   * The value lives in an alien-signals node. Reads go through it, which is what makes automatic
   * dependency tracking work for anything that reads this signal from inside an alien computed or
   * effect — no bridge required, because the alien node *is* the storage.
   *
   * The write path keeps the original shape and semantics: a `===` comparison decides whether this is
   * a change (so `NaN` always changes and `-0`/`0` never does), and the listener Set is still fanned
   * out synchronously. alien's own propagation covers the alien side of the graph; `fireChanged`
   * covers the jsx6 side (`observe`/`observeNow`/`subscribe` are unchanged).
   */
  const src = alienSignal(value)
  let current = value // mirrors `src` for the `===` check, updated on every write through this wrapper

  function setValue(v) {
    if (v === current) return
    current = v
    src(v)
    return true
  }

  const $signal = (...args) => {
    // Getter. `src()` is only required when somebody upstream is collecting dependencies — reading the
    // alien node is what registers the dependency. Outside an alien computation (the overwhelmingly
    // common case: `$s()`, `$s.x++`, DOM updaters, imperative reads right after a write) the plain
    // closure value is returned, which keeps this path as cheap as the original implementation.
    // Measured: routing *every* read through the alien node costs ~3.6x on write+read.
    if (args.length === 0) return activeSub() === undefined ? current : src()

    // setter
    if (setValue(args[0])) {
      fireChanged()
      return true
    }
  }

  Object.defineProperty($signal, ValueSymbol, { get: $signal }) // allows getting velue in Chrome dev tools
  // Console inspection: expanding a signal in the dev console shows its current value under `value`.
  // Read at expand time rather than at log time, non-enumerable, and never a supported read in code —
  // see the same property in `libs/signal/src/signal.js` for the full rationale.
  Object.defineProperty($signal, 'value', { get: $signal, configurable: true })
  Object.defineProperty($signal, srcSymbol, { get: () => src }) // internal: the backing alien node
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
  $signal[Symbol.toPrimitive] = $signal.get = () => current

  return { $signal, fireChanged, listeners, setValue }
}

export const runFuncNoArg = f => {
  try {
    f()
  } catch (e) {
    console.error(e, f)
  }
}
