/**
 * Computed signals, batching and disposal for the alien-backed core.
 *
 * The graph is alien's: `$C`/`$CE` are `alien.computed` nodes, so propagation, glitch-freedom,
 * memoization and topological ordering all come from the battle-tested implementation rather than
 * from this library.
 *
 * What still has to exist here is the **jsx6 surface**:
 *
 *   - the callable read shape (`$c()`), including reads that must stay tracked when this computed is
 *     itself read from inside another alien computation (so `return c()` always, never a cached copy);
 *   - `subscribeSymbol`, implemented with a ROOT `alien.effect` created on the first real subscriber
 *     (laziness is preserved: a computed with no reader and no subscriber never evaluates), and with
 *     the first effect run suppressed so that `observe` still means "no immediate callback";
 *   - `triggerSymbol`, `label`/`name`, and `dispose()` (stopping the push effect releases the
 *     computed's dependency links, which is upstream issue #79's recommended remedy).
 *
 * Two rules from the compat work apply here as well and are not optional:
 *   * every effect is created as a ROOT (`setActiveSub(undefined)`), so a binding is owned by its own
 *     disposer and is never auto-disposed when an enclosing effect re-runs;
 *   * the push effect's body never returns a user value (alien would treat a truthy non-function
 *     return as a cleanup function and throw on the next run).
 */

import { subscribeSymbol, triggerSymbol } from './observe.js'
import { runFuncNoArg, srcSymbol } from './signal.js'
import { effect, setActiveSub, startBatch, endBatch, computed, trigger } from './alien.js'

/**
 * Coalesce several writes into a single alien flush. Exception-safe: a throw still closes the batch,
 * so the scheduler can never be left permanently deferred (upstream issue #96).
 */
export const batch = fn => {
  startBatch()
  try {
    return fn()
  } finally {
    endBatch()
  }
}

const rootEffect = fn => {
  const prev = setActiveSub(undefined)
  try {
    return effect(fn)
  } finally {
    setActiveSub(prev)
  }
}

/**
 * @param {Function} getValue
 * @param {{ eager?: boolean, declaredDeps?: Array<any>, name?: string }} [options]
 * @returns {Function} callable, read-only computed signal carrying the jsx6 signal protocol
 */
export function createComputedSignal(getValue, { eager = false, declaredDeps = [], name } = {}) {
  const listeners = new Set()
  let node
  let pushStop
  let pushStarted = false

  /** Read the declared dependencies so alien links them (covers $State aggregates and alien nodes). */
  const readDeclared = () => {
    for (const dep of declaredDeps) {
      if (typeof dep !== 'function') continue
      try {
        dep()
      } catch (e) {
        console.error(e, dep)
      }
    }
  }

  const ensure = () => {
    if (!node) node = computed(() => (readDeclared(), getValue()))
    return node
  }

  const ensurePush = () => {
    if (pushStarted) return
    pushStarted = true
    const inner = ensure()
    let first = true
    // Root effect: never owned by a caller's effect, never auto-disposed by an enclosing re-run.
    pushStop = rootEffect(() => {
      inner()
      if (first) {
        first = false
        return undefined
      }
      listeners.forEach(runFuncNoArg)
      return undefined
    })
  }

  const $computed = (...args) => {
    if (args.length) return undefined // read-only derived value
    return ensure()()
  }

  $computed[subscribeSymbol] = u => {
    if (typeof u !== 'function') throw 'listener must be a function'
    listeners.add(u)
    ensurePush()
    return () => listeners.delete(u)
  }
  $computed[triggerSymbol] = () => trigger(() => ensure()())
  $computed[Symbol.toPrimitive] = $computed.get = () => ensure()()
  $computed.dispose = () => {
    if (pushStop) pushStop()
    pushStop = undefined
    pushStarted = false
    node = undefined
  }
  $computed.__computed = true
  // Expose the backing alien computed so that (a) `$S`/`$F` recognise this as one of ours rather than
  // an opaque duck-typed dependency, and (b) `toAlien()` on a computed is free instead of a bridge.
  Object.defineProperty($computed, srcSymbol, { get: () => ensure(), configurable: true })
  if (name) {
    $computed.label = name
    Object.defineProperty($computed, 'name', { value: name })
  }

  // Eager derives keep the computed hot (a root effect reads it on every invalidation), which is the
  // behaviour `$S`/`$F` have always had: they recompute whether or not anybody listens.
  if (eager) ensurePush()

  return $computed
}

/** Lazy, memoized computed (alien's), with optional explicitly declared dependencies. */
export const $C = (getValue, ...declaredDeps) => createComputedSignal(getValue, { declaredDeps })

/** Eager computed: kept hot by a root effect from creation. */
export const $CE = (getValue, ...declaredDeps) =>
  createComputedSignal(getValue, { eager: true, declaredDeps })

/** Release a computed's dependency links by stopping its push effect. */
export const dispose = $computed => $computed?.dispose?.()
