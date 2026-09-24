# How it is implemented

One new module (`src/computed.js`), one new helper module (`src/track.js`), and five lines inside the
existing signal getter. Nothing else in the eager core changed. This page walks the data structures and
the lifecycle, with excerpts injected from the source.

## The pieces

| piece | file | job |
| --- | --- | --- |
| read hook | `src/signal.js` | every signal read offers itself to the active collector |
| collector holder | `src/track.js` | the active collector, read inline on the hot path |
| `createComputed` | `src/computed.js` | one computed signal: value, dependencies, subscriptions, invalidation |
| batch queue | `src/computed.js` | pending settle calls, flushed in dependency order |
| state integration | `src/state.js` | `$State` updates wrapped in a batch |

## The read hook

The hook is the reason the feature is possible at all, and it is deliberately three lines:

[../../src/signal.js](../../src/signal.js#region:read-hook)

```js
      // Dependency-tracking hook, inlined on purpose: one monomorphic property read on the hot path,
      // and nothing else while no computed is evaluating.
      const collector = trackState.collector
      if (collector !== null) collector.add($signal)
```

Because the hook sits in *our* getter, a read has to go through our signal to be tracked. That is the
whole reason an alien-signals `computed` cannot track `@jsx6/signal` values without a bridge: alien runs
its own subscriber, never this getter. (The reverse direction is solved by
[`@jsx6/signal-alien`](./alien-core.md), where the storage itself is alien's.)

## The collector

[../../src/track.js](../../src/track.js#region:track-state)

```js
export const trackState = { collector: null }
```

`collectStart(set)` swaps the collector in and returns the function that swaps it back; the hot path in
`createComputed` does that swap by hand to avoid two function calls per recomputation.

## Per-computed state

`createComputed` keeps its mutable state in closure variables rather than on the signal object, so a
computed signal stays a plain callable with the same protocol as `signal()`:

| variable | meaning |
| --- | --- |
| `tracked` | dependencies seen during the last collection pass (a reused `Set`, never reallocated) |
| `wanted` | the union of `tracked` and the declared dependencies, minus aggregate-covered children |
| `depSubs` | `Map` from dependency to the unsubscribe function this computed holds |
| `depth` | one more than the deepest dependency — the sort key that orders a flush |
| `dirty` | the published value may be stale |
| `collected` | a collection pass has happened at least once |
| `computing` | re-entrancy guard, so a cycle cannot recurse forever |

## Recomputation

`recompute(notify)` is the whole lifecycle in one function: optionally collect, evaluate the getter,
publish, and repair the subscription set.

[../../src/computed.js](../../src/computed.js#region:recompute)

```js
  const recompute = notify => {
    // Re-entered while this computed is already evaluating: the graph is cyclic (it reads itself,
    // directly or through other computed signals). Returning the previous value breaks the recursion
    // instead of overflowing the stack — and because that is otherwise silent, unlike a listener
    // feedback loop which dies at the stack limit with a logged RangeError, it is reported here. The
    // report does not change the return semantics: the caller still gets the previous value.
    if (computing) {
      if (!cycleReported) {
        cycleReported = true
        console.error(
          `computed: ${name || 'a computed signal'} was read while it was computing — cyclic ` +
            `dependency; returning the previous value`,
        )
      }
      return false
    }
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
```

Reading the code top to bottom, the order matters:

1. **collect** — only on the pass that is allowed to (`collectDeps === 'always'`, or the first pass),
   and the previous collector is restored in a `finally` so a throwing getter cannot leave tracking on;
2. **evaluate** — the getter runs with `computing` set, so a self-referential computed returns its
   previous value instead of recursing;
3. **publish** — `publish(next)` is the same `===`-guarded setter every signal uses, so an equal value
   notifies nobody;
4. **subscribe** — only when the dependency list could have changed, and `buildWanted`/`syncDeps` then
   add and drop subscriptions to match.

## Repairing subscriptions

[../../src/computed.js](../../src/computed.js#region:syncDeps)

```js
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
```

`syncDeps` also recomputes `depth` and sorts the flush queue by it, which is what makes a chain of
computeds settle in dependency order inside one `batch()` and never publish an intermediate value.

## Invalidation

A dependency calls this when it changes. For a lazy computed, invalidation is *only* a flag; for an
eager one, or one that has listeners, it also schedules a settle.

[../../src/computed.js](../../src/computed.js#region:invalidate)

```js
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
```

The `!eager && !listeners.size` early return is rule 3 of the design: a cold lazy computed is not
recomputed by a write — the value is produced when somebody asks for it.

## Settling: the publish decision

`settle()` is what an eager computed or a batch flush calls; it is where "should anybody be told?"
is decided.

[../../src/computed.js](../../src/computed.js#region:settle)

```js
    settle() {
      if (!dirty) return
      // A cold lazy computed stays dirty until somebody reads it (rule 3).
      if (!eager && !listeners.size) return
      recompute(true)
    },
```

`recompute(true)` means "publish and notify", and the `===` guard inside `publish` means the
notification only happens when the value really changed. So an eager computed over a dependency it
declares but never reads recomputes and stays silent.

## Batching

Two operations, and the queue between them:

[../../src/computed.js](../../src/computed.js#region:batch)

```js
export const batch = fn => {
  batchDepth++
  try {
    return fn()
  } finally {
    batchDepth--
    if (batchDepth === 0) flushPending()
  }
}
```

[../../src/computed.js](../../src/computed.js#region:flushPending)

```js
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
```

Notes on the flush:

* `batchDepth` is a counter, so nested batches work and only the outermost one flushes;
* the queue is a `Set`, so a computed invalidated twice in one batch settles once;
* items are sorted by `depth` before settling, so a derived-of-derived sees its input already updated;
* the guard is a **cycle** guard, not a depth limit: a broken graph logs and drops the pending work
  instead of hanging the browser, and it never fires for a correct graph.

## Cycles and failure modes

The old core's direct execution is also its diagnostic tool: a feedback loop recurses on the stack, so
it dies at the stack limit instead of spinning in a queue forever. That property is **preserved** — the
new code does not queue or defer anything on the normal path — and it is worth being precise about what
"dies" means, because the pre-existing `runFuncNoArg` catch changes how it presents:

```js
export const runFuncNoArg = f => {
  try {
    f()
  } catch (e) {
    console.error(e, f)
  }
}
```

So a runaway listener loop is not a thrown crash. Measured on both the frozen 1.8.18 control and the
current core (a listener that writes the signal it observes):

| core | value after the loop | max listener nesting | `console.error` calls | first message |
| --- | --- | --- | --- | --- |
| frozen 1.8.18 | 8395 | 8393 | 4 | `RangeError: Maximum call stack size exceeded.` |
| current | 8430 | 8428 | 4 | `RangeError: Maximum call stack size exceeded.` |

The circuit breaker is the **stack limit**: the loop stops, the process survives, and the loop is
visible in the logged error — the same behaviour, same mechanism, in both cores.

The same holds for an *eager* cyclic pair of computeds: two mutually dependent `$CE` signals
invalidated inside one batch ran 17 806 recomputations in 9 ms and ended by exhausting the stack, with
`RangeError` logged, rather than hanging.

### The one shape that would otherwise be quiet

A **lazy** computed cycle is absorbed by the re-entrancy guard rather than by the stack limit. It is the
first thing [`recompute`](#recomputation) checks (`if (computing)`), and instead of recursing it returns
the previously published value — no overflow, no hang. Because that would otherwise be the one *silent*
failure mode in the library, the guard reports it, **once per computed**:

```
computed: a computed signal was read while it was computing — cyclic dependency; returning the previous value
```

Once per computed rather than per read, because a broken graph can be read on every render and a
repeating error line is noise. The report does not change what the caller gets — the previous value is
still returned, so a cyclic computed degrades instead of taking the application down — and it costs
nothing on the healthy path: the branch is only reached while this computed is already evaluating.

Measured consequences:

| shape | result | getter evaluations | logged |
| --- | --- | --- | --- |
| `$C` that reads itself | `NaN` | 1 | the cycle report, once |
| two `$C`s depending on each other | `NaN` / `NaN` | 2 | the cycle report, once per computed |
| `$CE` that reads itself | previous value | 1 | the cycle report, once |
| `$S` whose getter writes its own source | value used, no loop | 1 | nothing (no re-entrancy: the write is not a read) |
| eager cyclic pair (above) | stack limit | 17 806 | `RangeError` |
| listener feedback loop | stack limit | — | `RangeError` |

So every cyclic shape is now visible in the console — either as the cycle report (guarded, returns the
previous value) or as a logged `RangeError` (unguarded recursion stopped by the stack limit).

`@jsx6/signal-alien` reports the same way, from its read wrapper, because in that core the re-entrancy
guard lives inside alien-signals: `alien` hands back the previous value on a re-entrant read without
raising anything, so the report is what makes the cycle findable there too.

One historical note: quiet cycles are not *new*. A derived signal that declares itself already
stabilised at a value with no error in 1.8.18 (measured: `5`, zero logs, in both the old and the new
core) — that shape never re-enters a getter, so there is nothing to report.

The batch backstop is a second line of defence, and a cyclic graph may never reach it — the stack limit
fires first. It is documented for completeness, not as the primary protection: see the
[flush guard](#batching) above. A pure computed cycle that *does* reach it (no listener chain to
overflow) is dropped after 1000 flushes with
`computed: possible dependency cycle, dropping pending recomputations` on the console.

## Releasing subscriptions

[../../src/computed.js](../../src/computed.js#region:release-deps)

```js
  const dispose = () => {
    for (const unsubscribe of depSubs.values()) if (typeof unsubscribe === 'function') unsubscribe()
    depSubs.clear()
    dirty = true
  }
```

`dispose($computed)` calls exactly this. It leaves `dirty = true` on purpose: a disposed computed that
is read again recomputes and re-subscribes, so disposal is never a correctness trap — only a way to stop
holding dependencies you no longer need.

## Subscribing through the bare protocol

`observe`/`observeNow` pull a value and are unaffected by laziness, but `subscribe($c, cb)` — the
protocol helper that just registers a listener — would have left a lazy computed with no dependencies
and therefore nothing to announce. The subscribe hook forces the first evaluation:

[../../src/computed.js](../../src/computed.js#region:subscribe-hook)

```js
  // A lazy computed owns no dependency subscriptions until it has been evaluated, so registering a
  // listener through the bare signal protocol (`subscribe($c, cb)`, which by contract pulls no value)
  // must force that first evaluation — otherwise the new listener could never be notified of anything.
  // `observe`/`observeNow` pull the value themselves and are unaffected.
  $computed[subscribeSymbol] = u => {
    const unsubscribe = publish[subscribeSymbol](u)
    if (!collected || dirty) recompute(false)
    return unsubscribe
  }
```

## `$State` integration

`$State` already had its own batching level for aggregate events. Instead of rewriting that, the update
paths were wrapped in the new `batch()`, so a derived signal depending on several children settles once
while the previous aggregate semantics stay exactly as they were:

[../../src/state.js](../../src/state.js#region:updateValue)

```js
  function updateValue(nv = {}, skipFire) {
    // Wrapped in the computed batch so that a derived signal depending on several children of this
    // state settles once, with no intermediate value — while the existing `batchLevel` below keeps
    // its own aggregate-event semantics untouched.
    return batch(() => {
      let changed = false
      batchLevel++
      try {
        for (let p in nv) {
          if (getSignal(p)(nv[p])) changed = true
        }
      } finally {
        batchLevel--
      }
      if (!skipFire && changed) fireChanged()
      return changed
    })
  }
```

## Summary of the flow

```
write $a(5)
  └─ setValue → value changed → fireChanged
       └─ listeners: one invalidate() per dependent computed
            ├─ lazy + cold + no listeners  → dirty = true, stop
            └─ eager or has listeners      → node.settle()
                 ├─ outside a batch        → recompute(true) now
                 └─ inside a batch         → pending.add(node); outermost batch flushes by depth

read $c()
  └─ dirty? → recompute(false)
       ├─ (maybe) collect reads           → tracked
       ├─ run the getter                  → next value
       ├─ publish(next)                   → notify only if next !== previous
       └─ (maybe) rebuild subscriptions   → wanted / syncDeps / depth
```

Next: [changes.md](./changes.md) for what each of these changes cost, and which parts of the design were
rejected before this one was chosen.