import { observe, observeNow, triggerSymbol, subscribeSymbol, isObservable } from './src/observe.js'
import { prepareSignal, signal, asSignal, staticSignal } from './src/signal.js'

/** Utility that that returns signal value if the parameter is a signal/function and the parameter otherwise.
 * This is especially useful when you want to handle cases whare you allow either a signal or a raw value
 *
 * @param {Function<any>|any} $signal
 * @returns any
 */
export const signalValue = $signal => (typeof $signal === 'function' ? $signal() : $signal)
/**
 * If called with single parameter creates new signal.
 *
 * If called with 2 or more parameters creates a new signal that is combination of one or more signals.
 * First parameter is function that creates the derived value whenever any of the the signals change
 * @param {Function|any} template inital value when creating a signal or template function when making derived signal
 * @param  {...Function} signals
 * @returns
 */
export function $S(template, ...signals) {
  if (!signals.length) return signal(template)

  // $S`something ${$signal}` support
  if (template instanceof Array && template.raw) {
    template = callbackForTemplateString(template, signals)
  }

  const { $signal } = prepareSignal(template())
  const updater = () => $signal(template())
  signals.forEach(b => observe(b, updater))

  return $signal
}

/**
 * creates a new signal that is combination of one or more signals.
 * First parameter is function that creates the derived value whenever any of the the signals change.
 * Function will be called with current value of each signal, order matching order of signals
 * @param {Function} filter function making derived signal from values
 * @param  {...Function} signals
 * @returns
 */
export function $F(filter, ...signals) {
  if (signals.length > 1) {
    const calculate = () => filter(...signals.map(signalValue))
    const { $signal } = prepareSignal(calculate())
    const updater = () => $signal(calculate())
    signals.forEach(b => observe(b, updater))
    return $signal
  } else {
    const $first = signals[0]
    if (isObservable($first)) {
      const { $signal } = prepareSignal(filter(signalValue($first)))
      observe($first, () => $signal(filter(signalValue($first))))
      return $signal
    } else {
      // static value
      return staticSignal($first)
    }
  }
}

/**
 *  function that combines values and strings between them from using as template function
```js
const formated = $S`Count:${$signal}` 
```
 *
 * @param {Array<String>} arr strings between values
 * @returns {function}
 */
const callbackForTemplateString = (arr, signals) => () => {
  let out = [arr[0]]
  for (let i = 1; i < arr.length; i++) {
    out.push(signalValue(signals[i - 1]), arr[i])
  }
  return out.join('')
}

export const VALUE = v => v
export const NOT = v => !v
export const BOOL = v => !!v
export const EQ = (a, b) => a == b
export const NEQ = (a, b) => a != b
export const EQX = (a, b) => a === b
export const NEQX = (a, b) => a !== b

export const $NOT = $signal => $F(NOT, $signal)
export const $BOOL = $signal => $F(BOOL, $signal)

export const $EQ = (to, $signal) => $F(EQ, to, $signal)
export const $NEQ = (to, $signal) => $F(NEQ, to, $signal)
export const $EQX = (to, $signal) => $F(EQX, to, $signal)
export const $NEQX = (to, $signal) => $F(NEQX, to, $signal)

export const $If = ($signal, t, f) => $F(v => (v ? t : f), $signal)

/** signal that is true if any of the signals is truthy */
export const $Any = (...signals) =>
  $S(() => {
    for (let i = 0; i < signals.length; i++) {
      if (signalValue(signals[i])) return true
    }
    return false
  }, ...signals)

/** signal that has value of first truthy signal value */
export const $AnyValue = (...signals) =>
  $S(() => {
    for (let i = 0; i < signals.length; i++) {
      let val = signalValue(signals[i])
      if (val) return val
    }
  }, ...signals)

export const $Or = ($sa, $sb) => $F((a, b) => a || b, $sa, $sb)
export const $OrB = ($sa, $sb) => $F((a, b) => !!(a || b), $sa, $sb)

export const $And = ($sa, $sb) => $F((a, b) => a && b, $sa, $sb)
export const $AndB = ($sa, $sb) => $F((a, b) => !!(a && b), $sa, $sb)

export const $Map = (map, $signal) => $F(v => map[v] || v, $signal)

export {
  observe,
  observeNow,
  signal,
  prepareSignal,
  triggerSymbol,
  subscribeSymbol,
  asSignal,
  staticSignal,
  isObservable,
}
export * from './src/state.js'
export * from './src/makeContext.js'
