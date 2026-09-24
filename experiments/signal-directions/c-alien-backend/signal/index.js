import {
  observe,
  observeNow,
  subscribe,
  triggerSymbol,
  subscribeSymbol,
  isObservable,
} from './src/observe.js'
import { prepareSignal, signal, asSignal, staticSignal, srcSymbol } from './src/signal.js'
import { createComputedSignal } from './src/computed.js'
import { stateSymbol } from './src/state.js'
import { isSignal as isAlienSignal, isComputed as isAlienComputed } from './src/alien.js'

/** An alien-signals node used as a dependency or a value. */
const isAlienNode = x => typeof x === 'function' && (isAlienSignal(x) || isAlienComputed(x))
/**
 * Because this core *is* alien-backed, an alien node is a legitimate observable here — the original
 * code's `isObservable` cannot know that (it only understands the symbol protocol and `.then`/
 * `.subscribe`), so `$F(fn, alienValue)` would otherwise take the static branch and hand back the node
 * itself as the value.
 */
const isObservableAny = x => isObservable(x) || isAlienNode(x)

/** Utility that that returns signal value if the parameter is a signal/function and the parameter otherwise.
 * This is especially useful when you want to handle cases whare you allow either a signal or a raw value
 *
 * @param {Function|any} $signal
 * @returns any
 */
export const signalValue = $signal => (typeof $signal === 'function' ? $signal() : $signal)

/**
 * A dependency the alien graph cannot see: it carries the duck-typing symbols (so it *is* observable)
 * but it is neither an alien-backed signal nor a `$State` proxy, so reading it registers nothing and
 * there is no node for alien to invalidate. `libs/jsx6/src/trans.js` builds exactly this shape.
 */
const isOpaqueDep = dep => !!dep && isObservable(dep) && !dep[srcSymbol] && !dep[stateSymbol]

/**
 * Legacy derived signal: the original implementation, kept **only** for opaque (duck-typed) deps.
 * Declared dependencies are subscribed through the listener Set exactly as before, so `$T` and
 * `$translationsSignal` keep working without any change.
 */
function createLegacyDerivedSignal(deps, getValue) {
  const { $signal } = prepareSignal(getValue())
  const updater = () => $signal(getValue())
  deps.forEach(b => subscribe(b, updater))
  return $signal
}

/**
 * Derived signal over the alien graph: an eager computed whose getter also reads the declared
 * dependencies, so the effective dependency set is *(declared deps)* ∪ *(reads tracked by alien)*.
 * @param {Array<any>} deps
 * @param {Function} getValue
 */
function createDerivedSignal(deps, getValue) {
  if (deps.some(isOpaqueDep)) return createLegacyDerivedSignal(deps, getValue)
  return createComputedSignal(getValue, { eager: true, declaredDeps: deps })
}

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
  if (template instanceof Array && /** @type {{raw?: any}} */ (template).raw) {
    template = callbackForTemplateString(template, signals)
  }

  return createDerivedSignal(signals, template)
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
  if (signals.length > 1 || isObservableAny(signals[0])) {
    return createDerivedSignal(signals, () => filter(...signals.map(signalValue)))
  } else {
    // static value
    return staticSignal(signals[0])
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
  $S(
    () => {
      for (let i = 0; i < signals.length; i++) {
        if (signalValue(signals[i])) return true
      }
      return false
    },
    ...signals,
  )

/** signal that has value of first truthy signal value */
export const $AnyValue = (...signals) =>
  $S(
    () => {
      for (let i = 0; i < signals.length; i++) {
        let val = signalValue(signals[i])
        if (val) return val
      }
    },
    ...signals,
  )

export const $Or = ($sa, $sb) => $F((a, b) => a || b, $sa, $sb)
export const $OrB = ($sa, $sb) => $F((a, b) => !!(a || b), $sa, $sb)

export const $And = ($sa, $sb) => $F((a, b) => a && b, $sa, $sb)
export const $AndB = ($sa, $sb) => $F((a, b) => !!(a && b), $sa, $sb)

export const $Map = (map, $signal) => $F(v => map[v] || v, $signal)

export {
  observe,
  observeNow,
  subscribe,
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

// ---------------------------------------------------------------- added by this direction
// Only the user-facing additions are exported from the package entry; the factory and the internal
// source marker stay reachable through `src/` (which the manifest ships) but are not public API.
export { $C, $CE, batch, dispose } from './src/computed.js'
