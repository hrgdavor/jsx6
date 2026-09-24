# How dependencies are found

A computed in `@jsx6/signal` can discover its dependencies in two ways, and it uses both at once:
by **reading** them inside the getter (auto-tracking), and by being **told** about them (the declared
list, as `$S`/`$F` always did). The effective dependency set is the union.

This page explains what is tracked, what cannot be, and why the union is the compatibility bridge that
made the feature shippable.

## The read hook

Tracking is possible because this library owns its signal getter. Every read of a signal calls into the
collector — one property read, and nothing else when no computation is running:

[../../src/signal.js](../../src/signal.js#region:read-hook)

```js
      // Dependency-tracking hook, inlined on purpose: one monomorphic property read on the hot path,
      // and nothing else while no computed is evaluating.
      const collector = trackState.collector
      if (collector !== null) collector.add($signal)
```

[../../src/track.js](../../src/track.js#region:track-state)

```js
export const trackState = { collector: null }
```

The collector is installed around a recomputation and removed afterwards:

[../../src/track.js](../../src/track.js#region:collectStart)

```js
export const collectStart = into => {
  const prev = trackState.collector
  trackState.collector = into
  return () => {
    trackState.collector = prev
  }
}
```

Two design notes that the measurements forced, both visible in the excerpts above:

* the hook is **inlined** in the getter rather than wrapped in a helper function — calling a helper on
  every read cost +65 % on a 200k write+read loop;
* the collector lives in a **mutable object** (`trackState.collector`) rather than an exported `let`
  with getter/setter functions, because it is switched on and off around every recomputation.

## Auto-tracking in use

[examples/dependencies.js](./examples/dependencies.js#region:tracked)

```js
const $a = signal(1)
const $b = signal(2)

// No dependency list: both reads are tracked.
const $sum = $C(() => $a() + $b())
assert.equal($sum(), 3)

$b(20)
assert.equal($sum(), 21)
```

## The union with the declared list

`$S(fn, ...deps)` and `$F(fn, ...deps)` did not change their signatures or their behaviour. What
changed is the *other* half: their callback runs under the collector, so reads are tracked too, and the
subscription set is built from both sources.

[examples/dependencies.js](./examples/dependencies.js#region:union)

```js
// An explicit list is still honoured, and it is a *union* with what the callback reads: the omitted
// `$b` is tracked anyway, so a forgotten dependency is no longer a silent bug.
// eslint-disable-next-line jsx6/signal-dependencies -- omitting $b is the point of this sample
const $unionSum = $S(() => $a() + $b(), $a)
assert.equal($unionSum(), 21)

$b(30)
assert.equal($unionSum(), 31)
```

The union is what makes the feature backwards compatible in both directions:

* **every existing call keeps working** — a declared dependency the callback never reads still
  invalidates the derived signal, because it is in the declared list;
* **an omitted dependency stops being a bug** — `$S(() => $a() + $b(), $a)` tracks `$b` as well, which
  is why the `jsx6/signal-dependencies` lint rule is now advice rather than a safety net.

The subscription set is assembled here — tracked reads first, then declared dependencies, with
dependencies *covered* by a declared `$State` aggregate dropped:

[../../src/computed.js](../../src/computed.js#region:buildWanted)

```js
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
```

The coverage rule is what keeps `$State` cheap: `$S(fn, $s)` declares the aggregate **and** (via
tracked reads) its children, and all four children fire on exactly the same changes as the aggregate
does. Subscribing both would recompute up to four times per `mergeValue`.

## The read that cannot be tracked

A dependency has to be one of *our* signals for the hook to see it. A duck-typed fake signal — the
shape `@jsx6/jsx6` uses for translations — is a plain function with the `Symbol.for` protocol bolted
on, so reading it is an ordinary function call and the collector never learns about it:

[examples/dependencies.js](./examples/dependencies.js#region:duck-typed)

```js
// A duck-typed signal (the shape `@jsx6/jsx6` uses for translations) has no getter of ours, so its
// read cannot be seen. The declared list is the only way to learn that it changed.
let shipping = 'standard'
const listeners = new Set()
const $shipping = () => shipping
$shipping[subscribeSymbol] = cb => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

const $label = $S(() => `shipping: ${$shipping()}`, $shipping)
assert.equal($label(), 'shipping: standard')

shipping = 'express'
listeners.forEach(cb => cb())
assert.equal($label(), 'shipping: express')
```

Such a dependency **must** be declared, exactly as before. `libs/jsx6/src/trans.js` is the live example:
`$F(t, $code, $translationsSignal)` reads translations through a closure, so `$translationsSignal` can
only ever be known from the declared list.

## The bug that this asymmetry hid

The first implementation compared the **tracked** set against the current subscriptions to decide
whether the subscription set was still correct. For a callback whose only dependency is a duck-typed
signal, the tracked set is *empty* — and empty matched empty, so the fast path concluded "nothing to
subscribe" and subscribed to **nothing**. The derived signal then recomputed never: a language switch
would have stopped updating every `$T(...)`.

The fix is the declared loop in the fast path, and the excerpt is short enough to show whole:

[../../src/computed.js](../../src/computed.js#region:depsAlreadySubscribed)

```js
  const depsAlreadySubscribed = () => {
    if (hasAggregateDep) return false
    for (const dep of declaredDeps) {
      if (dep && dep[subscribeSymbol] && !depSubs.has(dep)) return false
    }
    if (tracked.size !== depSubs.size) return false
    for (const dep of tracked) if (!depSubs.has(dep)) return false
    return true
  }
```

Two regression tests cover it (`a declared dependency the callback never reads is still subscribed` and
`$F with a duck-typed dependency behaves the same`), and both fail if the declared loop is removed.

## A declared dependency that is never read

The pre-existing contract is unchanged: a declared dependency invalidates the derived signal even if
the callback ignores it. The value may not change, in which case the `===` guard means no listener is
woken — but the getter does run.

[examples/dependencies.js](./examples/dependencies.js#region:declared-unread)

```js
// A declared dependency the callback never reads still invalidates — the 1.8 behaviour, preserved.
const $flag = signal(1)
let runs = 0
const $ignoresFlag = $S(() => {
  runs++
  return 'constant'
}, $flag)

assert.equal($ignoresFlag(), 'constant')
const before = runs
$flag(2)
assert.ok(runs > before) // it recomputed...
assert.equal($ignoresFlag(), 'constant') // ...and published the same value
```

## Collect once, or every time

Re-deriving the dependency list on every recomputation is what makes conditional dependencies work, but
it costs a `Set` rebuild per recomputation — and for an eager chain that is the whole hot path. So
there are two modes, chosen automatically:

[../../src/computed.js](../../src/computed.js#region:collect-deps-doc)

```js
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
```

| | `collectDeps` | dependency list | conditional dependencies | cost |
| --- | --- | --- | --- | --- |
| `$C`, `$CE` without a declared list | `'always'` | re-derived per recomputation | followed automatically | a `Set` rebuild per recomputation |
| `$S`, `$F`, `$CE` with a declared list | `'first'` | collected at creation | only the ones present on that first pass | same as the original eager implementation |

That single choice is the difference between "auto-tracking makes an eager chain 8× slower" and
"+9 % on a 4-deep chain" — see [changes.md](./changes.md#cost).