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
  let computing = false
  // An error from the eager push effect (a write invalidated the computed and the getter failed): the
  // failure belongs to the *reader*, so the write must not throw. The plain core behaves that way, and a
  // write that threw would break whatever code happened to write the signal (an event handler, a form).
  let deferred
  let deferErrors = false
  // The last value the getter produced: handed back to alien when a recomputation fails, so a failure is
  // never mistaken for a change (see `readGuarded`).
  let lastValue
  // Reported once per computed: a broken graph can be read on every render, and a repeating error line
  // is noise rather than information.
  let cycleReported = false

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
    if (!node) node = computed(() => (readDeclared(), readGuarded()))
    return node
  }

  /**
   * Runs the caller's getter, remembering that it is running.
   *
   * alien-signals breaks a re-entrant read of the computed being computed by handing back the previous
   * value — no stack overflow, no hang, and no error. That silence is the hard part of diagnosing a
   * cyclic graph, so the read wrapper reports it once per computed (see `$computed` below) while
   * leaving alien's return semantics exactly as they are.
   */
  const readGuarded = () => {
    computing = true
    try {
      const value = getValue()
      lastValue = value
      deferred = undefined
      return value
    } catch (e) {
      // A failure must never escape into alien's machinery: it would surface from alien's own dirty-check
      // during a *write* (`flush → checkDirty → updateComputed`), so writing a signal could throw because
      // some derived value failed — the plain core defers that to the reader. The error is recorded here
      // and reported by `$computed` below, which also drops the settled node so the next read re-evaluates
      // instead of handing back a cached `undefined` (the plain core never settles after a throw).
      deferred = e
      // alien gets the last known-good value, so a failed recomputation is not a *change*: a write that
      // fixes the cause recomputes the same value and — like the plain core — notifies nobody.
      return lastValue
    } finally {
      computing = false
    }
  }

  const ensurePush = () => {
    if (pushStarted) return
    pushStarted = true
    const inner = ensure()
    let first = true
    // Root effect: never owned by a caller's effect, never auto-disposed by an enclosing re-run.
    pushStop = rootEffect(() => {
      // Creating an eager computed whose getter already fails throws, exactly as the plain core does; once
      // it is live, a failed recomputation only records the error and skips the notification.
      const creating = !deferErrors
      inner()
      if (deferred) {
        if (creating) throw deferred
        return undefined
      }
      if (first) {
        first = false
        return undefined
      }
      listeners.forEach(runFuncNoArg)
      return undefined
    })
    deferErrors = true
  }

  const $computed = (...args) => {
    if (args.length) return undefined // read-only derived value
    // Re-entrant read: the graph is cyclic. alien-signals returns the previous value and recurses no
    // further, so this only adds the report — the value the caller sees is unchanged.
    if (computing && !cycleReported) {
      cycleReported = true
      console.error(
        `computed: ${name || 'a computed signal'} was read while it was computing — cyclic ` +
          `dependency; returning the previous value`,
      )
    }
    // A failure recorded by the evaluation above: report it here, because the read is where it belongs, and
    // drop the settled node so the next read re-evaluates (and either reports the failure again or recovers
    // once a write has fixed the cause).
    const value = ensure()()
    if (deferred) {
      const error = deferred
      deferred = undefined
      node = undefined
      throw error
    }
    return value
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
  // Console inspection, as on a plain signal: expanding a computed shows its current value under
  // `value`, read at expand time. Non-enumerable, and never a supported read in application code.
  Object.defineProperty($computed, 'value', { get: $computed, configurable: true })
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
