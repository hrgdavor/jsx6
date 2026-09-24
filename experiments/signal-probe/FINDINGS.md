# Tracing: the wrapper signal, the internals it needed, and the measurements

**Date:** 2026-09-24
**Scope:** implemented in `libs/signal` (`src/trace.js`, `src/trace-signal.js`,
`src/state-write-observer.js`, five small hooks, 22 tests). `libs/signal-alien` is **out of scope** by
request — it is a near-copy and would need the same port if this ships, so the decision to leave it is
recorded here rather than silently taken.

---

## 1. What was built

### `traceSignal($sig, options)` — a signal you can watch

A thin, drop-in signal (subscribe/trigger/primitive all delegated) that reports its own activations:

```js
const $w = traceSignal($total, { label: 'total' })   // reads and real writes, to the console
$w()                                                  // [trace] read computed total = 3  depth=1
$w.show()                                             // { signal, kind, value, origin, deps, getter, raw }
$w.snapshot()                                         // the same object, not logged
```

`show()` is the point: a signal is a function, and DevTools renders a function value as source text
without listing its properties, so `console.log($sig)` cannot show anything. Logging a **plain object
whose `getter` is the compute function** gives DevTools an enumerable property to render as
`getter: ƒ cartTotal` — a clickable reference that jumps to the function's source.

Options: `label`, `log`, `warn`, `trace`, `only: 'read'|'write'|'both'`, `max` (default 5),
`getter` (wrap a bare compute function), `onActivate` (called on every activation, ignores `max`).

### `$State` support (`src/state-write-observer.js`)

A state wrapper needed one hook, because the proxy's `set` trap writes the **raw child signal** — a
wrapper around `$s.field`, or around the state, never sees it:

```js
const $s = traceSignal($State({ count: 0 }), { label: 'cart' })
$s.count = 1                  // [trace] write $State cart.count = 1
mergeValue($s, { count: 2 })  // [trace] write $State cart.count = 2
$s({ count: 3 })              // [trace] write $State cart.count = 3
$s({ count: 4 })              // ...and the reset of any field absent from the patch
```

`onStateWrite(observer)` is the primitive underneath it, with `hasStateWriteObservers()` for the trap's
guard. The state wrapper is a **Proxy** handle rather than the plain callable the signal case uses,
because a state is written as `$s.field = …` — without property interception `$t.name = 'grace'` hits
the wrapper function's own `name`. Plain signals deliberately do not pay for that.

### The internals it needed (`src/trace.js`)

| export | what it gives a debugger |
| --- | --- |
| `traceSignals(bool \| {origin, listeners})` | opt in; returns the previous state |
| `signalsTraced`, `traceOptions` | the flag and its refinements |
| `signalTrace($s)` / `metaSymbol` | the record: `{ kind, origin, listeners, getter, deps }` |
| `ensureTrace($s, kind)` | attach a record to a signal created before tracing was asked for |
| `captureSite()` / `captureFrom(stack)` / `captureSiteSkipping(files)` | a `file:line:col` site, plus `file`/`line`/`column`/`raw` |
| `describeName($s)` | a printable name without triggering a getter |

### The hooks in the library (all gated)

| file | change |
| --- | --- |
| `src/signal.js` | `prepareSignal` captures the origin for a **named** signal while tracing; attaches the record (site + live listener set) |
| `src/computed.js` | `createComputed` attaches `getter` (the *user's* function) and `deps()` (`{tracked, declared}`) while tracing |
| `src/state.js` | the proxy's `set` trap reports a child write: **one guarded line** |
| `index.js` | exports the internals, `traceSignal`, `onStateWrite` |
| `src/debug.js` | comment only: why its `callerSite` does not share the tracing filter (see §5) |

---

## 2. Performance: the constraint was "must not affect performance"

`bench-hooks.mjs` compares `libs/signal` at HEAD against the working tree, in one process, rotating
order, best-of-40. (`bench-ab.mjs`'s full-suite numbers move by tens of percent between passes — machine
noise, not signal — so it is kept only as a sanity check.)

| path | before | after | Δ (best) | Δ (median) |
| --- | --- | --- | --- | --- |
| create named signal (50k) | 12.05 ms | 12.24 ms | +1.6 % | **−1.0 %** |
| create anonymous signal (50k) | 7.09 ms | 7.15 ms | +0.9 % | **+0.8 %** |
| write+read (50k, no creation) | 0.32 ms | 0.33 ms | +3.2 % | **+3.2 %** |
| create+read `$C` (20k) | 22.72 ms | 22.73 ms | +0.1 % | **+1.0 %** |

`bench-state-trap.mjs` is the focused measurement of the one hot path that changed — the proxy's `set`
trap, 200k writes per sample, best *and* median of 60 rounds:

| `$State` path | Δ best | Δ median |
| --- | --- | --- |
| field write `$s.a = i` | −0.8 % | **−1.0 %** |
| `mergeValue` (3 fields) | −0.1 % | **+0.6 %** |
| new child `$s.fresh = i` | +0.3 % | **−0.2 %** |
| `setValue` `$s({a:i})` | −0.0 % | **+0.6 %** |

Calibration from the same runs: one empty function call is **12.1 ns**. Every delta is inside the
measurement's own noise and comes out negative about as often as positive. **Nothing was added to the
read, write, notify or subscribe paths of a signal**; the state trap gained one guarded call that
short-circuits on a `null` comparator. The enabled path costs ~10× on signal *creation* (a record per
signal), and the stack walk is not the expensive part of it — `Object.defineProperty` on a function is:

| mode | 50k named signals |
| --- | --- |
| tracing off | 14.7 ms |
| record only (`{origin: false}`) | 185 ms (+1157 %) |
| record + origin stack walk | 168 ms (+1038 %) |

So: enable tracing for a **repro**, prefer `traceSignal` on specific signals for long sessions.

Guard against regression: `bun test libs/signal` (104 tests, 22 in `src/trace.test.js`), plus oxlint,
oxfmt and `tsc --noEmit` on the package.

---

## 3. What the *existing* collector mechanism can do without any library change

Kept because these are the techniques a wrapper uses, and because they bound what is possible when
internals cannot be touched. Scripts: `check.mjs`, `chain-check.mjs`, `chain-check2.mjs`.

1. **Reads of one activation — free.** `trackState.collector` is a single mutable slot; installing a
   fresh `Set` around a getter reports what that getter read, including nested reads that are not
   themselves recomputations.
2. **A cold lazy computed hides its reads**: they happen inside its own recompute, which swaps the
   collector; the caller only sees the computed itself. Warm reads escape.
3. **Writes are invisible** without a hook: `===` means no listener is called, and there is no setter
   hook. For `$State` specifically the trap is the hook; for signals a probe computed is the only way.
4. **Listeners cannot be enumerated** without the internals — hence the `listeners` field in §1.
5. **`__depth` is only trustworthy for declared-dependency shapes** (`$S`/`$F`: measured 1/2/3). For
   `$C`/`$CE` chains it reads 1/1/1 whatever the creation order, because `depth = max(dep.__depth) + 1`
   counts an unsubscribed dependency as 0 (`src/computed.js`, `syncDeps`). Documented, not fixed:
   fixing it is a change to computed semantics, not a debugging change.

---

## 4. Honest limits of the wrapper

| limit | why | what to do |
| --- | --- | --- |
| reads inside *another* computed are not reported as activations | the wrapper's read hook is outside that computed's recompute, and reporting them would be noise, not an activation by the user | expected; a dependency read still activates the *outer* read |
| a signal created **before** tracing was requested has a site-only record | the listener set and a computed's getter are create-time facts and cannot be recovered | `traceSignals(true)` at startup, or wrap the signal |
| the wrapper adds a call on every activation of the signal it wraps | that is the price of per-signal observation | it is opt-in per signal; unwrapped signals are untouched |
| a throwing getter still throws from a read | the library's own contract (`computed-errors.test.js`): the read reports the failure | `snapshot()` reports it as `⚠ message` without throwing |
| `getter` for a computed wrapped via `$C` is anonymous | `$C`/`$CE` take *declared dependencies* after the getter, not a name | pass `label`, or use a named function |
| an observer outlives its state if the wrapper is never disposed | registration is per wrapper; the state does not own it | `$w.dispose()` (it is the only cleanup a wrapper needs) |
| `libs/signal-alien` has none of this | out of scope by request | it is a near-copy; a port is mechanical |

### Mistakes worth recording

* **Sharing the frame filter** between `src/debug.js` (`showCallSite`) and `src/trace.js` was implemented
  and reverted: a capture made *from inside* `debug.js` cannot distinguish "the library" from the file it
  is standing in, so the shared filter reported the console wrapper itself and broke `showCallSite`.
* **Filtering frames by directory** looked principled but matches every test, example and application
  under the repository root, which made origins come back empty. It is now filtered by this library's
  **file names** plus this module's own file by identity, with a fallback that reports a library frame
  rather than nothing.
* **`ensureTrace` probed `__computed` on a `$State` proxy**, and reading an unknown key through that
  proxy *creates a child signal* — so tracing a state silently added a `__computed` field to it. Every
  probe now tests for a state first, and there is a test that pins it.
* **The trap notified before knowing whether the value changed**, so `$s.a = 1` twice reported twice.
  It now reports only a real change, read only while an observer exists.
* **A computed's record had no creation site at all** — `createComputed` attached `getter`/`deps` but
  never passed `origin`, and `attachTrace` only captures one when asked. Found by writing the docs example
  that prints `snapshot().origin`.
* **Session options were sticky across sessions**, so one `traceSignals({origin: false})` silently
  degraded every later `traceSignals()`. Found because the doc examples share a process: an earlier
  example disabled origins and a later one then reported `origin: undefined`. `traceSignals()` now
  restores the defaults; `traceSignals(false)` still only turns tracing off.
* **`traceSignal($C(fn))` attaches nothing for the computed** when the computed is constructed *before*
  the call: `$C(...)` evaluates first, so `createComputed`'s gate was still off, and `ensureTrace` then
  retrofits a record with no `getter` and no `deps`. Call `traceSignals()` first (the docs example does),
  or wrap a signal that already exists.

---

## 5. Documentation

`libs/signal/doc/trace/usage.md` plus five runnable examples in `doc/trace/examples/`, executed by
`doc/trace/examples.test.js` and injected into the page by `@hrg/inject-examples` (`bun run docs:inject` /
`docs:inject:check`, which now cover `doc/trace` next to `doc/computed`). A wrong explanation fails the
package's own suite, and the injection check fails when a sample drifts from its source.

