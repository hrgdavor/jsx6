/**
 * @jsx6/signal-alien — the jsx6 signal contract implemented on top of alien-signals.
 *
 * Same public API as `@jsx6/signal` (verified as a drop-in replacement: export surface, behaviour,
 * emitted types and the shipped test suite), with alien-signals as the storage and the propagation
 * graph, plus the interop layer that makes the two worlds usable together in both directions.
 *
 * Layer map — which code comes from where:
 *
 *   src/signal.js    jsx6 side: the callable signal, the `===` change check, the listener Set, the
 *                    `Symbol.for` protocol, label/name/devtools affordances. Only the *storage* is
 *                    alien (`alien.signal`), which is what lets alien track bare reads with no bridge.
 *   src/computed.js  jsx6 side: `$C`/`$CE`/`batch`/`dispose` as a thin surface over `alien.computed`
 *                    and a root `alien.effect` that pushes into the jsx6 listener Set.
 *   src/compat.js    interop: `toAlien`/`toSignal` bridges and alien-aware `observe`/`subscribe`.
 *   src/alien.js     the single import of the dependency.
 *   src/observe.js, src/state.js, src/makeContext.js
 *                    jsx6 side, unchanged from `@jsx6/signal` except that `$State` batches through
 *                    alien's `startBatch`/`endBatch`.
 *
 * See README.md for the bundle-size breakdown of this jsx6-side code versus alien-signals itself.
 */

import {
  observe as coreObserve,
  subscribe as coreSubscribe,
  triggerSymbol,
  subscribeSymbol,
  isObservable as coreIsObservable,
} from './src/observe.js'
import { prepareSignal, signal, asSignal, staticSignal, srcSymbol } from './src/signal.js'
import { createComputedSignal } from './src/computed.js'
import { stateSymbol } from './src/state.js'
import { isSignal as alienIsSignal, isComputed as alienIsComputed } from './src/alien.js'
import { makeCompat } from './src/compat.js'

/** An alien-signals node used as a dependency or a value. */
const isAlienNode = x => typeof x === 'function' && (alienIsSignal(x) || alienIsComputed(x))
/**
 * Because this core *is* alien-backed, an alien node is a legitimate observable here — the original
 * code's `isObservable` cannot know that (it only understands the symbol protocol and `.then`/
 * `.subscribe`), so `$F(fn, alienValue)` would otherwise take the static branch and hand back the node
 * itself as the value.
 */
const isObservableAny = x => coreIsObservable(x) || isAlienNode(x)

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

// ---------------------------------------------------------------- the jsx6 contract
export { signal, prepareSignal, triggerSymbol, subscribeSymbol, asSignal, staticSignal }
export * from './src/state.js'
export * from './src/makeContext.js'

// ---------------------------------------------------------------- new: the computed axis
// Only the user-facing additions are exported from the package entry; the factory and the internal
// source markers stay reachable through `src/` (which the manifest ships) but are not public API.
export { $C, $CE, batch, dispose } from './src/computed.js'
// Debugging: console interception so console.log($sig) shows a value. See src/debug.js.
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

// ---------------------------------------------------------------- new: alien interop
const compat = makeCompat({
  signal,
  observe: coreObserve,
  subscribe: coreSubscribe,
  isObservable: coreIsObservable,
})

/** alien-signals itself, re-exported so consumers do not pull in a second copy. */
export const alien = compat.alien

/**
 * Zero-cost bridging: this package's signals are alien-backed, so the alien node *is* the mirror. Only
 * foreign (non-`@jsx6/signal-alien`) signals need the listener-based bridge from the compat layer.
 */
export const toAlien = node => node?.[srcSymbol] || compat.toAlien(node)
/** alien node -> jsx6 signal, cached per node. Needed for `$S`/`$F` dependencies on alien values. */
export const toSignal = compat.toSignal
export const isAlienSignal = compat.isAlienSignal
export const isAlienComputed = compat.isAlienComputed
export { isAlienNode }

// These four carry the alien-aware implementations (the core's versions are imported under `core*`
// names above), which is what makes `{$computed}` usable where JSX expects a signal.
export const observe = compat.observe
export const observeNow = compat.observeNow
export const subscribe = compat.subscribe
export const isObservable = compat.isObservable
