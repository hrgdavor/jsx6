/**
 * Dependency tracking hook — the whole reason a `computed` can exist in this core.
 *
 * `signal.js`'s getter calls `collect($signal)` on every read. When no computation is in flight
 * `activeCollector` is `null`, so the cost is a single falsy check on the hot read path.
 *
 * This is only possible because the library owns its getter. It is also why an alien-signals
 * `computed` cannot track a signal from this library without a bridge: alien never runs this getter
 * with its own subscriber active.
 */

/**
 * The active collector, exported as a live binding so `signal.js` can test it inline:
 *
 *     if (activeCollector !== null) activeCollector.add($signal)
 *
 * Calling a helper function there instead costs a real function call on *every* signal read — measured
 * at +65 % on a 200k write+read loop, which is the difference between "free when idle" and "noticeable
 * on the hottest path in the library".
 */
/**
 * The tracking state lives in a single mutable holder.
 *
 * Why a holder instead of a module-level `let` plus getter/setter functions: the collector is switched
 * on *and* off around every recomputation, and read on every single signal read. Function calls for
 * that (measured) cost far more than a property access on a monomorphic object, and a live-binding
 * export can only be assigned by its declaring module. `state.collector` is therefore read inline by
 * `src/signal.js` and written inline by `src/computed.js` — no calls, no closures, no allocation.
 */
// #region track-state
/**
 * `collector` is explicitly typed so both `collector.add(dep)` here and the
 * `trackState.collector = tracked` assignment in `src/computed.js` are checked against the same
 * shape. Left untyped, TypeScript 7 infers `collector` as `null` (the only value at declaration),
 * and every later assignment or property access in the library becomes an error.
 *
 * @type {{ collector: Set<Function> | null }}
 */
export const trackState = /** @type {{ collector: Set<Function> | null }} */ ({ collector: null })
// #endregion track-state

/**
 * Convenience wrapper for callers that prefer a scoped form; it allocates a closure, so the hot path
 * (`src/computed.js`) does not use it.
 * @param {Set<Function>} into
 * @returns {() => void}
 */
export const collectStart = into => {
  const prev = trackState.collector
  trackState.collector = into
  return () => {
    trackState.collector = prev
  }
}

/** Register a dependency for the computation currently in flight (no-op when none is). */
export const collect = dep => {
  const collector = trackState.collector
  if (collector !== null) collector.add(dep)
}

/** True while a computation is in flight (used by tests/diagnostics). */
export const isCollecting = () => trackState.collector !== null
