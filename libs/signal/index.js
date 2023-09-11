/**
 * @typedef {Function} Signal
 */

import { observe, observeNow, triggerSymbol, subscribeSymbol } from './src/observe.js'
import { prepareSignal, signal } from './src/signal.js'

export const signalValue = $signal => (typeof $signal === 'function' ? $signal() : $signal)
/**
 * If called with single parameter creates new signal.
 *
 * If called with 2 or more parameters creates a new signal that is combination of one or more signals.
 * First parameter is function that creates the derived value whenever any of the the signals change
 * @param {function|any} template inital value when creating a signal or template function when making derived signal
 * @param  {...Signal} signals
 * @returns
 */
export function $S(template, ...signals) {
  if (!signals.length) return signal(template)

  // $S`something ${$signal}` support
  if (template instanceof Array && template.raw) {
    template = callbackForTemplateString(template, signals)
  }

  const { $signal } = prepareSignal(template())

  signals.forEach(b => observe(b, () => $signal(template())))

  return $signal
}

/**
 * creates a new signal that is combination of one or more signals.
 * First parameter is function that creates the derived value whenever any of the the signals change.
 * Function will be called with current value of each signal, order matching order of signals
 * @param {function} filter function making derived signal from values
 * @param  {...Signal} signals
 * @returns
 */
export function $F(filter, ...signals) {
  if (signals.length > 1) {
    const calculate = () => filter(...signals.map(signalValue))
    const { $signal } = prepareSignal(calculate())
    signals.forEach(b => observe(b, () => $signal(calculate())))
    return $signal
  } else {
    const $first = signals[0]
    const { $signal } = prepareSignal(filter($first()))
    observe($first, () => $signal(filter($first())))
    return $signal
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
  return out
}

export const $NOT = $signal => $F(v => !v, $signal)
export const $IS = $signal => $F(v => !!v, $signal)

export const $EQStrict = (to, $signal) => $F(v => to === v, $signal)
export const $NEQStrict = (to, $signal) => $F(v => to !== v, $signal)
export const $EQ = (to, $signal) => $F(v => to == v, $signal)
export const $NEQ = (to, $signal) => $F(v => to != v, $signal)

export const $If = ($signal, t, f) => $F(v => (v ? t : f), $signal)

export const $Any = (...signals) =>
  $S(() => {
    for (let i = 0; i < signals.length; i++) {
      if (signalValue(signals[i])) return true
    }
    return false
  }, ...signals)

export const $AnyValue = (...signals) =>
  $S(() => {
    for (let i = 0; i < signals.length; i++) {
      let val = signalValue(signals[i])
      if (val) return val
    }
  }, ...signals)

export const $Or = ($sa, $sb) => $S(() => $sa() || $sb(), $sa, $sb)
export const $OrB = ($sa, $sb) => $S(() => !!($sa() || $sb()), $sa, $sb)

export const $And = ($sa, $sb) => $S(() => $sa() && $sb(), $sa, $sb)
export const $AndB = ($sa, $sb) => $S(() => !!($sa() && $sb()), $sa, $sb)

export const $Map = (map, $signal) => $F(v => map[v] || v, $signal)

export { observe, observeNow, signal, prepareSignal, triggerSymbol, subscribeSymbol }
