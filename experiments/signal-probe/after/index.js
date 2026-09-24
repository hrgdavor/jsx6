import {
  observe,
  observeNow,
  subscribe,
  triggerSymbol,
  subscribeSymbol,
  isObservable,
} from './src/observe.js'
import { prepareSignal, signal, asSignal, staticSignal } from './src/signal.js'
import { createComputed } from './src/computed.js'

/** Utility that that returns signal value if the parameter is a signal/function and the parameter otherwise.
 * This is especially useful when you want to handle cases whare you allow either a signal or a raw value
 *
 * @param {Function|any} $signal
 * @returns any
 */
export const signalValue = $signal => (typeof $signal === 'function' ? $signal() : $signal)
/**
 * Internal helper to create a derived signal.
 *
 * This is the union-dependency eager computed: the dependency set is the declared list **plus** every
 * read tracked while `getValue` ran, so existing call sites keep their exact behaviour while an
 * omitted dependency is no longer a bug.
 *
 * @param {Array<Function>} signals declared dependencies
 * @param {Function} getValue
 * @returns {Function} $signal
 */
function createDerivedSignal(signals, getValue) {
  return createComputed(getValue, { eager: true, declaredDeps: signals })
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
  if (signals.length > 1 || isObservable(signals[0])) {
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
// Debugging: `installConsoleInspection()` makes `console.log($sig)` show a value, with no change at the
// call site and no cost on any signal path. See `src/debug.js`.
export {
  describeSignal,
  hasConsoleInspection,
  installConsoleInspection,
  isSignalish,
  readSignal,
  signalKind,
  signalLabel,
  signalName,
  uninstallConsoleInspection,
} from './src/debug.js'

// Tracing internals: opt-in, and inert until `traceSignals(true)`. They expose the creation site, the
// listener set behind `subscribe`, and (for computeds) the getter and dependency set — the facts a
// debugger wrapper needs and nothing else. See `src/trace.js`.
export {
  attachTrace,
  captureFrom,
  captureSite,
  captureSiteSkipping,
  describeName,
  ensureTrace,
  metaSymbol,
  signalTrace,
  signalsTraced,
  traceOptions,
  traceSignals,
} from './src/trace.js'

// `traceSignal` — a wrapper signal that reports its own activations, and the reason the internals
// above exist. Use it to debug one signal without paying anything anywhere else. See
// `src/trace-signal.js`.
export { traceSignal } from './src/trace-signal.js'

// State write observation: `$State` writes go through the proxy's `set` trap onto the raw child
// signal, so a wrapper cannot see them by itself. Inert (one null check in the trap) until something
// registers. See `src/state-write-observer.js`.
export { hasStateWriteObservers, onStateWrite } from './src/state-write-observer.js'

// ---------------------------------------------------------------- added by this direction
// Only the user-facing additions are public; `createComputed` stays internal (reachable via `src/`).
export { $C, $CE, batch, dispose } from './src/computed.js'
