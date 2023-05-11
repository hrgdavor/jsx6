import { isArray, isFunc } from './core.js'
import { doSubscribeValue } from './makeState.js'
import { subscribeSymbol, triggerSymbol, tryObserve } from './observe.js'
/** Creates a new signal taht is used by calling tranformer function, that uses values from
 * one or more bindings. Syntax is similar to prinf in the fact that values that will be used
 * are privided as varargs, and first param defines how they are combined
 *
 * @param {Function} transformer that create values for the new signal
 * @param  {...Function} bindings
 * @returns
 */
export const $S = (transformer, ...bindings) => {
  if (isArray(transformer) && transformer.raw) {
    transformer = callbackForTemplateString(transformer)
  }
  const updaters = []
  let value
  const getValue = () => value

  function recalculate() {
    const params = bindings.map(b => (isFunc(b) ? b() : b))
    const tmp = transformer(...params)
    if (tmp !== value) {
      value = tmp
      fireChanged()
    }
  }

  const fireChanged = () => {
    if (updaters.length) {
      updaters.forEach(u => u(value))
    }
  }

  bindings.forEach(b => tryObserve(b, recalculate))

  getValue[subscribeSymbol] = (u, skipTrigger) => doSubscribeValue(updaters, u, getValue, skipTrigger)
  getValue[triggerSymbol] = fireChanged

  return getValue
}

const callbackForTemplateString =
  arr =>
  (...values) => {
    let out = arr[0]
    for (let i = 1; i < arr.length; i++) {
      out += values[i - 1] + arr[i]
    }
    return out
  }

export const $R = $S

export const $NOT = signal => $S(v => !v, signal)
export const $IS = signal => $S(v => !!v, signal)

export const $EQStrict = (to, signal) => $S(v => to === v, signal)
export const $NEQStrict = (to, signal) => $S(v => to !== v, signal)

export const $EQ = (to, signal) => $S(v => to == v, signal)
export const $NEQ = (to, signal) => $S(v => to != v, signal)

export const $If = (signal, t, f) => $S(v => (v ? t : f), signal)
export const $Any = (...signals) =>
  $S((...arr) => {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i]) return true
    }
    return false
  }, signals)
export const $Or = (sa, sb) => $S((a, b) => a || b, sa, sb)
export const $And = (sa, sb) => $S((a, b) => a && b, sa, sb)

export const $Map = (map, signal) => $S(v => map[v] || v, signal)
