# What changed, what it costs, and what was rejected

The feature was added **around** the existing core rather than through it. This page is the change
record: files touched, behaviour preserved, the measured cost, and the designs that were tried and
dropped.

## Files

| file | change |
| --- | --- |
| `src/track.js` | **new** — the collector holder and `collectStart` |
| `src/computed.js` | **new** — `createComputed`, the `$C`/`$CE`/`batch`/`dispose` API, the pending queue |
| `src/signal.js` | the read hook (three lines in the getter) and one import |
| `src/state.js` | `updateValue`/`setValue` wrapped in `batch()`, and the child-signal map exposed under `stateChildrenSymbol` so a computed can apply the aggregate-coverage rule |
| `index.js` | `createDerivedSignal` now builds an **eager union-dependency computed** instead of the old hand-rolled derived signal; `$C`, `$CE`, `batch`, `dispose` exported |
| `src/computed.test.js` | **new** — 20 tests for the computed axis |
| `src/debug.js` | **new** — `describeSignal`/`signalLabel` and `installConsoleInspection()`, so `console.log($sig)` shows a value with no call-site change |
| `src/inspect.test.js`, `src/computed-errors.test.js` | **new** — the `value` getter contract, and the failure semantics of a throwing computed |
| `README.md`, `doc/signals.md` | revised: the "auto-magic is not implemented here" sections were replaced with what is now true |

The package's public surface grew by the computed axis (`$C`, `$CE`, `batch`, `dispose`) plus the
debugging helpers, and it still declares **no runtime dependency**:

[../../package.json](../../package.json#region:name,dependencies)

```json
{
  "name": "@jsx6/signal",
  "dependencies": {}
}
```

## What deliberately did not change

This list is the compatibility contract, and every line of it is covered by a test that was already
there before the feature existed — the 30 pre-existing tests pass **unmodified**:

* reads and writes stay plain calls, returning `true`/`undefined`, with `===` change detection;
* `prepareSignal` still returns `{ $signal, fireChanged, listeners, setValue }` with the same semantics;
* the `Symbol.for('signalSubscribe')` / `signalTrigger` protocol, and Promise/Observable interop;
* `observe` / `observeNow` / `subscribe` semantics, including `observe` not calling back immediately;
* `$S(fn)` with a single argument is still the **value** form, not a derived signal;
* `$F(fn, oneStaticValue)` still takes the static branch and returns that value unchanged;
* `$S`/`$F` remain **eager** — laziness is opt-in through `$C`;
* propagation stays synchronous, so stack traces still show who wrote the value;
* notification stays value-guarded, so an unchanged recomputation wakes nobody;
* `$State` semantics, including reset-to-`undefined` and its aggregate event.

## The `$State` change

The one existing code path that was restructured. `$State` needs both behaviours: a derived signal
depending on several children must settle once per merge, while the aggregate event of the state itself
must keep firing exactly as before. Rather than fuse the two, the update path was wrapped in the new
batch and the old level was left in place:

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

## Cost

Bundle size, measured with esbuild and gzipped (`bun experiments/signal-directions/harness/size-packages.js`):

| bundle | plain | minified | gzipped |
| --- | --- | --- | --- |
| `@jsx6/signal@1.8.18` (before the feature) | 6.4 kB | 2.4 kB | **1.2 kB** |
| `@jsx6/signal` with the computed axis | 12.3 kB | 4.8 kB | **2.2 kB** |
| difference | +5.9 kB | +2.4 kB | **+1.0 kB** |

The +1.0 kB gzip buys `$C`, `$CE`, `batch`, `dispose`, the collector, union dependencies, the cycle report and the console `value` getter for
`$S`/`$F` — and it is the whole cost, because nothing else was added to the dependency graph.

Timing, against the frozen 1.8.18 control (`experiments/signal-directions/RESULTS.md`):

| bench | 1.8.18 | with computed | read |
| --- | --- | --- | --- |
| 2M write+read | 16.1 ms | 17.0 ms | +5 % |
| 4-deep eager chain | 5.18 ms | 5.39 ms | +4 % |
| diamond | 7.39 ms | 8.76 ms | +19 % |
| `$State` merge | 5.09 ms | 7.63 ms | +50 % |
| computed read (5M) | n/a | 1.93 ms | new capability |
| 300 components: mount | 6.39 ms | 7.04 ms | +10 % |
| 300 components: 3000 writes | 7.75 ms | 6.92 ms | −11 % |
| 300 components: unmount | 1.05 ms | 0.95 ms | −10 % |
| heap retained after unmount | 629 kB | 684 kB | +8.7 % |

How to read that:

* **the hot read path is essentially untouched** (+5 % on a loop that does nothing but write and read,
  which no application does in that proportion);
* **an eager chain is unchanged** (+4 %) — that is the `collectDeps: 'first'` decision paying off;
* **a `$State` merge is slower in isolation** (+50 %) because it now also maintains a batch, and the
  diamond case pays for union-dependency bookkeeping. Both buy correctness: one settled value instead
  of an intermediate state, and an omitted dependency that is no longer a silent bug;
* **the workload this library is built for is unchanged** — the long-lived-component benchmark moves
  within ±11 % on every phase.

The uncomfortable row is `$State` merge, and it is worth being explicit: merging four properties now
costs more CPU in the merge itself, and less downstream work (one recomputation of a dependent derived
signal instead of up to four). If a profile ever shows the merge itself dominating, the batch wrapper
around `updateValue` is the first thing to re-measure.

## Designs that were rejected

**Making alien-signals the core.** The most obvious way to get `computed` is to adopt an existing
signal library as the implementation. Measured: it costs a new dependency, +2.0 kB gzip, ~+30 % bundle
in a real application, and up to +190 % on hot eager paths. It is a good fit for projects that want
alien's graph itself — so it ships as a **separate** package, [`@jsx6/signal-alien`](./alien-core.md),
lockstep-released and drop-in verified, rather than as a replacement for this one.

**Lazy by default.** Turning `$S`/`$F` into lazy computeds would change *when* existing applications
compute and therefore when they notify. The eager model is the library's stated priority (immediate
propagation keeps stack traces meaningful), so laziness was added beside it, not underneath it.

**Auto-batching.** Coalescing writes without being asked would remove intermediate values from every
existing app. `batch()` is opt-in, and the default path still propagates immediately.

**Re-collecting dependencies on every recomputation for `$S`/`$F`.** The first implementation did
exactly that, and a 4-deep eager chain measured **+744 %**. Three changes brought it back to +4 %: the
hook was inlined in the getter instead of calling a helper, the collector was moved into a mutable
holder object, and collection became once-at-creation for computeds that have a declared list.

**Allocating fresh `Set`s per recomputation.** Two `Set`s per recompute made a 4-deep chain 8× slower;
`tracked` and `wanted` are reused.

**Rewriting `$S`/`$F` as thin wrappers over `$C`.** It looks tidier, but it would have put the lazy
code path under the hottest existing API. Instead both go through `createComputed` with different
options, which shares the machinery without sharing the timing.

**Proxy handles, so DevTools' custom formatters could read a signal.** A signal is a function, and DevTools
formats proxy values but not functions — so making each handle a transparent `Proxy` was the only way to
get `console.log($sig)` to render through a formatter, and it worked (the entry read `signal 7`). It was
removed anyway, because the cost is on every read:

| bench | plain signal | proxy handle | difference |
| --- | --- | --- | --- |
| 2M write+read | 26.75 ms | 349.93 ms | **+1208 %** |
| 3-deep eager chain (200k) | 18.17 ms | 101.18 ms | **+457 %** |
| 2M computed reads | 7.68 ms | 190.03 ms | **+2373 %** |

About 13× on a read-heavy loop — and in this library a read is meant to be a plain call. Console
interception gives the same readable entry for none of that cost, and the `value` getter covers the rest,
so the proxy mode **and** the custom formatter that only existed to render it were both removed, rather
than shipped behind a flag. The numbers stay here as the reason.

## Five defects the effort found and fixed

1. **A lazy computed subscribed without being read never evaluated.** `observe`/`observeNow` pull a
   value and were fine, but the bare `subscribe($c, cb)` protocol registers a listener without reading,
   so a never-read lazy computed had no dependencies and could never notify. The subscribe hook now
   forces that first evaluation.
2. **A declared dependency the callback *can't* be seen reading was subscribed to nothing.** This
   affected duck-typed signals — in this repository, the translation signal used by `$T(...)` in
   `libs/jsx6/src/trans.js` — so switching language would have stopped updating every translated value.
   The subscription fast path now checks declared dependencies as well as tracked reads; see
   [dependencies.md](./dependencies.md#the-bug-that-this-asymmetry-hid).
3. **Coercing a `$State` threw.** `Symbol.toPrimitive` handed back the *snapshot object*, which is not a
   primitive, so `String($state)`, `` `${$state}` ``, `$state + ''` and `+$state` all threw
   `TypeError: Symbol.toPrimitive returned an object`. This one is **pre-existing** — the frozen 1.8.18
   control throws identically — and it surfaced while building the dev-console demo page, where printing
   a state is the first thing you want to do. A string hint now returns the JSON snapshot and a number
   hint `NaN`, so `` `${$state}` `` prints `{"name":"Ada","age":36}`. Nothing could have depended on the
   old behaviour, because it always threw.

4. **Direction C forgot an error a computed had thrown.** `alien-signals` settles a computed whose getter
   threw as *clean, value `undefined`*, so the **second** read silently returned `undefined` instead of
   reporting the failure again — the plain core re-runs the getter on every read, so an unconditional
   failure keeps reporting and a write that fixes the cause recovers. Found by a test in the new console
   work, not by the comparison harness: none of its contract cases exercised a *throwing* getter. The
   alien core now drops the settled node and reports the recorded error, and a case was added to the
   harness so any future direction is checked for it.
5. **Direction C let a *write* throw because a derived value failed.** With an eager computed
   (`$CE`/`$S`/`$F`) whose getter started failing, the exception came out of alien's own dirty-check
   during the dependency write (`flush → checkDirty → updateComputed`), so `$base(1)` threw — an event
   handler or form writing a signal would have broken. The plain core defers the failure to the reader.
   Both are now fixed in the alien core: a failed recomputation is recorded, the last known-good value is
   handed back (so recovery is not mistaken for a change, and the value guard stays quiet), the failure is
   reported by the next read, and creating an eager computed whose getter already fails still throws, as
   it does in the plain core.

Each has a regression test that fails when the fix is removed. Fix 3 changed one assertion in
`src/state.test.js`'s `specials` test — the old assertion pinned the defect by calling the hook directly
and expecting an object; it now asserts the primitive, while the snapshot object stays asserted on the
next line through `toJSON()`. Every copy of that file (this package, `@jsx6/signal-alien`, and the two
experiment cores) was updated together, so the copies remain byte-identical to each other.

## How this is verified

* the 30 pre-existing tests (one assertion updated with fix 3, as above) plus 28 new ones in
  `src/computed.test.js` and `src/inspect.test.js`;
* every code sample in this documentation set is executed by `bun test` through
  [`examples.test.js`](./examples.test.js), and injected into the pages by
  `bunx @hrg/inject-examples` so a sample cannot drift from the code it claims to show;
* the whole repository gate — `bun run check --build`: tests, declaration emit, `tsc --noEmit`, oxlint,
  oxfmt, version and catalog checks, docs sync, manifest audit, workspace integrity;
* the independent comparison harness in
  [`experiments/signal-directions`](../../../../experiments/signal-directions/README.md): a frozen
  1.8.18 control, a 44-case contract, micro and macro benchmarks, a drop-in verification of the public
  surface and emitted types, and a real-application smoke test (`apps/repl`, unmodified, 10/10 checks).