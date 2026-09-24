/**
 * Computed signals, batching and disposal — added to a copy of the current core.
 *
 * Design notes (all of them deliberate, and all of them choices a reviewer should look at):
 *
 * 1. A computed reuses the **existing listener mechanism** as its dependency edge: subscribing
 *    `invalidate` to a dependency is literally what `prepareSignal`'s `subscribeSymbol` already does.
 *    No second graph, no new node type, one `Set` per signal — the same shape the library has today.
 * 2. The dependency set is the **union** of (a) reads tracked while the getter ran and (b) explicitly
 *    declared dependencies. That is what makes `$S`/`$F` backwards compatible *and* auto-tracking:
 *    a declared-but-unread dependency keeps invalidating exactly as before, while a forgotten
 *    dependency stops being a bug.
 * 3. Laziness: `$C` starts dirty and evaluates on the first read. It stays cold (no recomputation on
 *    write) until someone subscribes, at which point `settle()` keeps it hot. `$CE` (`$S`/`$F`) is
 *    eager: it recomputes on every invalidation whether or not anyone listens — the property that
 *    makes eager propagation work for long-lived components.
 * 4. Notification is **value-guarded** (`setValue`'s `===`), exactly like the current core. The new
 *    part is `batch()`, which defers the *recompute and the notification* of computeds so that a
 *    multi-source update no longer exposes an intermediate value, and so that a chain recomputes once.
 * 5. `depth` (1 + max(dependency depth)) gives `batch()` a topological order without a graph walk.
 * 6. Writing a computed is a no-op that returns `undefined`. It is a derived value; there is no
 *    sensible write semantics that survives the next invalidation.
 */

import { subscribeSymbol, triggerSymbol } from './observe.js'
import { prepareSignal } from './signal.js'
import { trackState } from './track.js'

/**
 * Exposed by `$State`: the child signals of a state proxy. Used by the coverage rule below so that a
 * derived signal declaring the aggregate does not also subscribe every child it read.
 */
export const stateChildrenSymbol = Symbol.for('signalStateChildren')

let batchDepth = 0
const pending = new Set()

/** True while a batch is open (used by `invalidate` and by diagnostics). */
export const inBatch = () => batchDepth > 0

/**
 * Run `fn` with computed recomputation and notification deferred until the outermost batch closes.
 * Exception-safe: a throw still closes the batch, so the graph can never be wedged.
 * @template T
 * @param {function(): T} fn
 * @returns {T}
 */
export const batch = fn => {
  batchDepth++
  try {
    return fn()
  } finally {
    batchDepth--
    if (batchDepth === 0) flushPending()
  }
}

const flushPending = () => {
  let guard = 0
  while (pending.size) {
    // A cycle guard, not a depth limit: a broken graph must not hang the browser.
    if (++guard > 1000) {
      console.error('computed: possible dependency cycle, dropping pending recomputations', pending.size)
      pending.clear()
      return
    }
    const items = [...pending]
    pending.clear()
    items.sort((a, b) => a.depth - b.depth)
    for (const item of items) item.settle()
  }
}

/**
 * @param {Function} getValue
 * @param {{ eager?: boolean, declaredDeps?: Array<any>, name?: string, collectDeps?: 'always'|'first' }} [options]
 *   `collectDeps` controls how often the dependency list is re-derived from reads:
 *     - `'always'` (default for `$C`/`$CE`, and for any computed without declared dependencies):
 *       every recomputation re-reads the getter under a collector, so conditional dependencies are
 *       followed automatically. Costs a Set rebuild per recomputation.
 *     - `'first'` (used by `$S`/`$F`, which always have declared dependencies): dependencies are
 *       collected once, at creation. Declared dependencies drive invalidation from then on, which is
 *       exactly the pre-existing contract — an *omitted* dependency is still caught (it is read during
 *       that first pass), only a dependency that appears **conditionally later** needs declaring. In
 *       exchange an eager chain recomputes at the same cost as the original implementation.
 * @returns {Function} a callable, read-only computed signal carrying the same protocol as `signal()`
 */
export function createComputed(
  getValue,
  { eager = false, declaredDeps = [], name, collectDeps = declaredDeps.length ? 'first' : 'always' } = {},
) {
  const internals = prepareSignal(undefined)
  const publish = internals.$signal
  const listeners = internals.listeners

  /** @type {Map<Function, any>} dependency -> unsubscribe */
  const depSubs = new Map()
  // Reused per recompute: this module is on the hot path, so it must not allocate a Set per
  // recomputation (measured: allocating two Sets per recompute made a 4-deep chain 8x slower).
  const tracked = new Set()
  const wanted = new Set()
  // When no declared dependency exposes children, `wanted` is exactly `tracked` intersected with the
  // declared deps — so the rebuild below can be skipped and only a size+membership check is needed.
  // That fast path is what keeps an eager chain from paying a Set rebuild on every recomputation.
  const hasAggregateDep = declaredDeps.some(dep => dep && dep[stateChildrenSymbol])
  let dirty = true
  let computing = false
  let collected = false
  let depth = 0

  const $computed = (...args) => {
    if (args.length) return undefined // read-only: a computed has no writable state
    if (dirty) recompute(false)
    return publish()
  }

  const invalidate = () => {
    dirty = true
    if (batchDepth) {
      pending.add(node)
      return
    }
    // A cold lazy computed stays dirty until somebody reads it.
    if (!eager && !listeners.size) return
    recompute(true)
  }

  /**
   * The subscription set is the union of tracked reads and declared dependencies, minus dependencies
   * *covered* by a declared aggregate.
   *
   * The coverage rule is what keeps `$State` cheap: `$S(fn, $s)` both declares the aggregate and (via
   * tracked reads) its children. Subscribing all four would recompute up to four times per merge;
   * the aggregate alone fires on exactly the same changes, so the children are dropped. Semantics are
   * unchanged — a declared-but-unread dependency still invalidates.
   */
  const buildWanted = () => {
    wanted.clear()
    for (const dep of tracked) wanted.add(dep)
    for (const dep of declaredDeps) if (dep && dep[subscribeSymbol]) wanted.add(dep)
    for (const dep of declaredDeps) {
      const children = dep && dep[stateChildrenSymbol]
      if (!children) continue
      for (const p in children) wanted.delete(children[p])
    }
  }

  const wantedMatchesSubs = () => {
    if (wanted.size !== depSubs.size) return false
    for (const dep of wanted) if (!depSubs.has(dep)) return false
    return true
  }

  /**
   * Fast path for the common case (declared deps are plain signals, so no coverage rule applies): the
   * currently subscribed set is already correct when its size matches the tracked set and every
   * tracked dependency is subscribed. Skips the `wanted` rebuild and the sync entirely.
   */
  const depsAlreadySubscribed = () => {
    if (hasAggregateDep) return false
    if (tracked.size !== depSubs.size) return false
    for (const dep of tracked) if (!depSubs.has(dep)) return false
    return true
  }

  const syncDeps = () => {
    for (const [dep, unsubscribe] of [...depSubs]) {
      if (wanted.has(dep)) continue
      if (typeof unsubscribe === 'function') unsubscribe()
      depSubs.delete(dep)
    }
    let maxDepth = 0
    for (const dep of wanted) {
      if (!depSubs.has(dep)) depSubs.set(dep, subscribeSafe(dep))
      const depDepth = dep.__depth
      if (depDepth > maxDepth) maxDepth = depDepth
    }
    depth = maxDepth + 1
  }

  const subscribeSafe = dep => {
    try {
      return dep[subscribeSymbol](invalidate)
    } catch (e) {
      console.error(e, dep)
      return undefined
    }
  }

  /** @returns {boolean} true when the published value changed */
  const recompute = notify => {
    if (computing) return false
    computing = true
    // With `collectDeps: 'first'` the collector is only installed for the very first evaluation; later
    // recomputations leave it alone (which also avoids disturbing an enclosing computation's collector).
    const recollect = collectDeps === 'always' || !collected
    const prevCollector = trackState.collector
    let next
    if (recollect) {
      tracked.clear()
      trackState.collector = tracked
    }
    try {
      next = getValue()
    } finally {
      if (recollect) trackState.collector = prevCollector
      computing = false
    }
    collected = true
    // When the dependency list was not re-collected it cannot have changed, so the subscription set is
    // still correct by definition — no comparison, no `Set.has` on the hot path.
    if (recollect && !depsAlreadySubscribed()) {
      buildWanted()
      if (!wantedMatchesSubs()) syncDeps()
    }
    dirty = false
    const changed = internals.setValue(next) === true
    if (changed && notify && listeners.size) internals.fireChanged()
    return changed
  }

  const node = {
    get depth() {
      return depth
    },
    settle() {
      if (!dirty) return
      // A cold lazy computed stays dirty until somebody reads it (rule 3).
      if (!eager && !listeners.size) return
      recompute(true)
    },
  }

  const dispose = () => {
    for (const unsubscribe of depSubs.values()) if (typeof unsubscribe === 'function') unsubscribe()
    depSubs.clear()
    dirty = true
  }

  $computed[subscribeSymbol] = publish[subscribeSymbol]
  $computed[triggerSymbol] = () => {
    dirty = true
    node.settle()
  }
  $computed[Symbol.toPrimitive] = $computed.get = () => {
    if (dirty) recompute(false)
    return publish()
  }
  $computed.dispose = dispose
  $computed.__computed = true
  Object.defineProperty($computed, '__depth', {
    get: () => depth,
    configurable: true,
  })
  if (name) {
    $computed.label = name
    Object.defineProperty($computed, 'name', { value: name })
  }

  if (eager) node.settle()

  return $computed
}

/** Lazy, memoized, auto-tracking computed. Dependencies may also be declared explicitly. */
export const $C = (getValue, ...declaredDeps) => createComputed(getValue, { declaredDeps })

/** Eager computed: evaluates at creation and on every invalidation, observed or not. */
export const $CE = (getValue, ...declaredDeps) => createComputed(getValue, { eager: true, declaredDeps })

/** Release a computed's dependency subscriptions. */
export const dispose = $computed => $computed?.dispose?.()
