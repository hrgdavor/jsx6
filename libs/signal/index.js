/**
 * @typedef {Function} Signal
 */

import { observe, observeNow } from './src/observe.js'
import { prepareSignal, signal } from './src/signal.js'

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
    template = callbackForTemplateString(template)
  }

  const calculate = () => template(...signals.map(b => (typeof b === 'function' ? b() : b)))

  const { $signal } = prepareSignal(calculate())

  const recalculate = () => $signal(calculate())

  signals.forEach(b => observe(b, recalculate))

  return $signal
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
const callbackForTemplateString =
  arr =>
  (...values) => {
    let out = [arr[0]]
    for (let i = 1; i < arr.length; i++) {
      out.push(values[i - 1], arr[i])
    }
    return out
  }

export const $NOT = $signal => $S(v => !v, $signal)
export const $IS = $signal => $S(v => !!v, $signal)

export const $EQStrict = (to, $signal) => $S(v => to === v, $signal)
export const $NEQStrict = (to, $signal) => $S(v => to !== v, $signal)
export const $EQ = (to, $signal) => $S(v => to == v, $signal)
export const $NEQ = (to, $signal) => $S(v => to != v, $signal)

export const $If = ($signal, t, f) => $S(v => (v ? t : f), $signal)

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

export { observe, observeNow, signal }
