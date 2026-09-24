/**
 * The alien-signals compatibility / interop layer, factored as a **core-agnostic factory**.
 *
 * It is deliberately not tied to one signal implementation: it discovers jsx6-style signals through
 * the public `Symbol.for` protocol rather than importing any core. That is what lets the same layer
 * be used by
 *
 *   A  (compat against the untouched `@jsx6/signal`),
 *   E  (alien's native API exposed next to it),
 *   F  (`$C` over bridged dependencies),
 *   C  (the alien-backed copy of the core, for its interop exports),
 *
 * and it means the compat layer keeps working across the symbol protocol exactly like
 * `src/observe.js` does.
 *
 * Three rules are non-negotiable here, each one empirically established (see the plan document):
 *
 *   1. NEVER hand a user callback's return value to `effect()`. alien treats a truthy non-function
 *      return as a cleanup function and throws `cleanup is not a function` on the next run.
 *   2. Create every effect as a ROOT (via `setActiveSub(undefined)`), so a binding is owned by its own
 *      disposer and is not auto-disposed when an enclosing effect re-runs. alien auto-disposes nested
 *      effects, which would silently tear down DOM bindings inside a `Loop` rebuild.
 *   3. Write into alien signals UNTRACKED, or the bridge becomes a dependency of its own effect.
 *
 * The bridge is mandatory for tracking: an alien `computed` that reads a bare jsx6 signal does not
 * track it (the read is a plain function call). Bridges are cached per source signal in a WeakMap.
 */

import * as alien from 'alien-signals'

export { alien }

export const subscribeSymbol = Symbol.for('signalSubscribe')
export const triggerSymbol = Symbol.for('signalTrigger')
export const alienSourceSymbol = Symbol.for('alienSource')

/** An alien signal or computed (both are bound functions; brand checks are name-based upstream). */
export const isAlienSignal = value => typeof value === 'function' && alien.isSignal(value)
export const isAlienComputed = value => typeof value === 'function' && alien.isComputed(value)
export const isAlienNode = value => isAlienSignal(value) || isAlienComputed(value)

/** A jsx6-style observable: anything carrying the public subscribe symbol. */
export const isSignalLike = value => !!(value && value[subscribeSymbol])

const untracked = fn => {
  const prev = alien.setActiveSub(undefined)
  try {
    return fn()
  } finally {
    alien.setActiveSub(prev)
  }
}

/** Run `fn` as a root effect (rule 2) and return the stop function. */
const rootEffect = fn => {
  const prev = alien.setActiveSub(undefined)
  try {
    return alien.effect(fn)
  } finally {
    alien.setActiveSub(prev)
  }
}

/**
 * @param {{ signal: (value?: any, name?: string) => any, observe?: Function, subscribe?: Function, isObservable?: Function }} core
 *   the signal implementation the compat layer should hand back for mirrored values. Only `signal` is
 *   required; `observe`/`subscribe`/`isObservable` are used to delegate the non-alien cases so their
 *   semantics stay exactly those of the core under test.
 */
/**
 * Compat instances are memoised per **core** (keyed by that core's `signal` function, which is unique
 * per implementation). This matters: `toAlien`/`toSignal` cache bridges and mirrors in instance
 * WeakMaps, so two compat instances over the same core would create two mirrors for one alien node and
 * split the dispose story. `_shared/derive-compat.js` relies on this to reuse the same instance.
 */
const instances = new WeakMap()

export function makeCompat(core) {
  const existing = instances.get(core.signal)
  if (existing) return existing
  const bridges = new WeakMap()
  const mirrors = new WeakMap()

  /** jsx6 signal -> alien node. Idempotent; cached per source. */
  function toAlien($sig) {
    if (isAlienNode($sig)) return $sig
    if (!$sig || typeof $sig !== 'function') return $sig
    let bridged = bridges.get($sig)
    if (bridged) return bridged

    const node = alien.signal(untracked(() => $sig()))
    const unsubscribe = $sig[subscribeSymbol]?.(() => untracked(() => node($sig())))
    node[alienSourceSymbol] = $sig
    // `dispose` is a jsx6-side affordance attached to the alien node; alien's own types do not have it.
    const alienNode = /** @type {any} */ (node)
    alienNode.dispose = () => {
      if (typeof unsubscribe === 'function') unsubscribe()
      alienNode.dispose = undefined
      bridges.delete($sig)
    }
    bridges.set($sig, node)
    return node
  }

  /** alien node -> jsx6 signal. Cached per node, so normalising a dependency twice is free. */
  function toSignal(node, name) {
    if (!isAlienNode(node)) return node
    let $mirror = mirrors.get(node)
    if ($mirror) return $mirror
    $mirror = core.signal(undefined, name)
    $mirror.dispose = rootEffect(() => {
      // Rule 1: block body, explicit undefined — `$mirror(node())` would return `true`.
      $mirror(node())
      return undefined
    })
    mirrors.set(node, $mirror)
    return $mirror
  }

  /** Normalise a dependency list so a derived signal can consume either world. */
  const normalizeDeps = deps => deps.map(d => (isAlienNode(d) ? toSignal(d) : d))

  /** alien node -> the equivalent of `_observe` for it (passValue/trigger semantics preserved). */
  function observeAlien(node, callback, trigger, passValue) {
    if (!callback) return undefined
    let first = true
    return rootEffect(() => {
      const value = node() // tracked read
      if (first) {
        first = false
        if (trigger) {
          if (passValue) callback(value)
          else callback()
        }
        return undefined
      }
      if (passValue) callback(value)
      else callback()
      return undefined
    })
  }

  const observe = (obj, callback, trigger = false) =>
    isAlienNode(obj) ? observeAlien(obj, callback, trigger, true) : core.observe(obj, callback, trigger)

  const observeNow = (obj, callback) => observe(obj, callback, true)

  const subscribe = (obj, callback, trigger = false) =>
    isAlienNode(obj) ? observeAlien(obj, callback, trigger, false) : core.subscribe(obj, callback, trigger)

  const isObservable = obj => isAlienNode(obj) || core.isObservable(obj)

  /** Coalesce several writes (jsx6 or bridged) into one alien flush. */
  const batch = fn => {
    alien.startBatch()
    try {
      return fn()
    } finally {
      alien.endBatch()
    }
  }

  const api = {
    alien,
    isAlienSignal,
    isAlienComputed,
    isAlienNode,
    isSignalLike,
    toAlien,
    toSignal,
    normalizeDeps,
    observe,
    observeNow,
    subscribe,
    isObservable,
    batch,
    /** Stop a mirror created by `toSignal`, or tear down a bridge created by `toAlien`. */
    dispose: node => node?.dispose?.(),
  }
  instances.set(core.signal, api)
  return api
}
