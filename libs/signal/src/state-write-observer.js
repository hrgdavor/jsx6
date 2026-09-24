/**
 * Write observation for `$State` — the one thing a wrapper cannot see by itself.
 *
 * ## The problem this solves
 *
 * `$state.field = 5` goes through the proxy's `set` trap, which writes the **raw** child signal:
 *
 *     set: (_, prop, value) => { getSignal(prop)(value); return true }
 *
 * So a wrapper installed around `$s.field` is bypassed — the write never travels through it. The same
 * is true of `mergeValue($s, {...})`, which also writes children directly, and of the reset-to-
 * `undefined` loop in `$State`'s `setValue`.
 *
 * ## Why the trap is the right place, and why it is not a cost
 *
 * The trap is *the* function that performs a state write, so observing there needs no second code
 * path and cannot drift from the real one. The cost is one null check on a set of listeners that is
 * `null` unless a debugger registered one — the same shape as the collector check in `signal.js`'s
 * getter. There is no wrapper, no proxy and no extra property on any signal when this goes unused.
 *
 * Reads need nothing: a wrapper around `$s.field` or around the state itself already sees every read,
 * because those go through *it*.
 */

/**
 * Observers of writes performed on `$State` children. `null` (not an empty Set) until the first
 * observer is registered, so the trap's check is a single compare against a monomorphic value.
 *
 * @type {Set<(child: Function, value: any) => void>|null}
 */
let stateWriteObservers = null

/**
 * @returns {boolean} whether any write observer is registered
 */
export const hasStateWriteObservers = () => stateWriteObservers !== null

/**
 * Call `observer` whenever a `$State` child signal is written through a proxy — including
 * `mergeValue` and the reset-to-`undefined` loop of `setValue`.
 *
 * @param {(child: Function, value: any) => void} observer receives the **raw child signal** (so a
 *   caller can match it by identity) and the value being written
 * @returns {() => void} unregister
 */
export const onStateWrite = observer => {
  if (typeof observer !== 'function') throw 'state write observer must be a function'
  if (stateWriteObservers === null) stateWriteObservers = new Set()
  stateWriteObservers.add(observer)
  return () => {
    stateWriteObservers?.delete(observer)
  }
}

/**
 * Called by the `$State` proxy's `set` trap. Deliberately not exported: it is the internal side of
 * `onStateWrite`, and a caller reaching for it would be reaching past the contract.
 *
 * @param {Function} child the raw child signal
 * @param {any} value the value being written
 */
export const notifyStateWrite = (child, value) => {
  if (stateWriteObservers === null) return
  // A snapshot: an observer may unregister itself from inside its own callback.
  for (const observer of [...stateWriteObservers]) {
    try {
      observer(child, value)
    } catch (e) {
      console.error(e, observer)
    }
  }
}
