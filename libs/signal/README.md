# signal implementation

For use with vanilla JS or JSX.

Priority is simpler implementation of the library, not going all the way for ease of use. Simplify debug versus adding guardrails so users don't shoot them selves in the foot.

Priority is also to propagate signal values immediately, to make use of stack trace for debugging. Performance improvements can be done before filling signals with values for critical code paths, and also after listenting to signal values (part of code that applies dom updates). 

# Computed signals

`$C` (lazy), `$CE` (eager), `batch()` and `dispose()`. The eager, immediately-propagating model above is
unchanged and is still the default — these are additions, not a redesign.

```js
import { signal, $C, $CE, batch, dispose } from '@jsx6/signal'

const $a = signal(1)
const $b = signal(2)

const $sum = $C(() => $a() + $b())   // lazy + memoized + auto-tracking, no dependency list
$sum()                                // 3 — evaluated on the first read

const $eager = $CE(() => $a() * 10)   // eager: recomputes whether or not anybody reads it

batch(() => {                         // one recomputation, no intermediate value visible
  $a(10)
  $b(20)
})

dispose($sum)                         // release a computed's dependency subscriptions
```

## `$S` / `$F` now use union dependencies

`$S(fn, ...deps)` and `$F(fn, ...deps)` keep their previous behaviour exactly, and additionally track the
signals `fn` reads while it runs. The effective dependency set is **declared dependencies ∪ tracked
reads**, so:

* every existing call keeps working unchanged — a declared dependency the callback never reads still
  invalidates the derived signal;
* an **omitted** dependency is no longer a silent bug: `$S(() => $a() + $b(), $a)` tracks `$b` too, which
  makes the `jsx6/signal-dependencies` lint rule a style guide rather than a safety net.

A dependency that is not one of our signals — a duck-typed fake signal (such as the translation signal in
`@jsx6/jsx6`), a Promise, an Observable — cannot be auto-tracked and still has to be declared.

## What did not change

* reads and writes are still plain calls returning `true`/`undefined`, with `===` change detection;
* `observe`/`observeNow`/`subscribe`, the `Symbol.for('signalSubscribe')` protocol, Promise/Observable
  interop and `$State` semantics are untouched;
* **no dependency was added** — the package still ships with none;
* `$S`/`$F` stay eager. `$C` is lazy by design; use `$CE` for eager auto-tracking.
* the existing test suite passes unmodified (30 tests), and the new behaviour is covered by 38 more.

## Inspecting in the dev console

A signal is a function, and Chrome renders a function value as a clickable source snippet — it lists none
of the function's own properties and does not run custom formatters for it. Three answers, in order of
how much you want bare `console.log($sig)` to work:

* **`console.log($count.value)`** — the non-enumerable `value` getter, on every signal and computed.
  Zero cost, works in every browser and in Node, no settings.
* **`installConsoleInspection()`** — the console methods are wrapped, so a signal argument is replaced by
  a described object while your call site stays as written:

  ```js
  installConsoleInspection() // once, in dev
  console.log('count is', $count) // {signal: '$count', kind: 'signal', value: 5, read: ƒ, raw: ƒ}
  ```

  No call-site change, no cost on any signal path, nothing to enable. It is opt-in, because it patches
  global console methods. The trade-off is that DevTools attributes entries to the wrapper, so
  `showCallSite: true` appends the real location and `console.log.original` is kept.
  `describeSignal`/`signalLabel` are usable on their own.

The proxy route — a transparent `Proxy` per handle, so DevTools' own formatters could read it — was built
and then removed: it put a trap on every read, measured at **~13×** on a read-heavy loop (2M write+read
26.75 ms → 349.93 ms). Console interception gives the same readable entry for none of that cost.
`bun experiments/signal-inspect/serve.js` serves a demo page for all of this. `$State` is
a proxy — inspect a field with `$s.field.value`, or print the state itself (`String($s)` gives its JSON
form). See
[usage.md#inspecting-signals-in-the-dev-console](doc/computed/usage.md#inspecting-signals-in-the-dev-console).

## Cost

The whole computed/batching/tracking axis adds **+1.0 kB gzip** to a bundle that uses the core API —
minified 2.4 kB → 4.8 kB, gzipped 1.2 kB → 2.2 kB. The measurement, and the comparison against the
alien-signals-based alternative [`@jsx6/signal-alien`](../signal-alien/README.md), is in
[experiments/signal-directions/USAGE-AND-SIZE.md](../../experiments/signal-directions/USAGE-AND-SIZE.md).

## Documentation set

[`doc/computed/`](doc/computed/README.md) documents this effort page by page, with every code sample
injected from the real source and from runnable examples (`bun run docs:inject` regenerates them,
`bun run docs:inject:check` fails when they drift):

* [usage](doc/computed/usage.md) — `$C`, `$CE`, `batch()`, `dispose()` in use
* [dependencies](doc/computed/dependencies.md) — auto-tracking, the union with the declared list, the one read that cannot be tracked
* [implementation](doc/computed/implementation.md) — the read hook, the collector, invalidation, settling, batching
* [changes](doc/computed/changes.md) — the change record, the measured cost, and the rejected designs
* [alien-core](doc/computed/alien-core.md) — the alien-signals implementation and how to move between the two

# TC39 signals

Aim is to be compatible, and watch for practical ides from the proposal (team there explores differences and similarities in implementations ATM)

https://github.com/tc39/proposal-signals

It is actual proposal than aims to standardize signals, and allow easier migration and cosolidate conept.

It prefers signals that automatically find their dependencies during value evaluation. `$C`/`$CE` now do
that for this library's own signals; explicit dependency lists remain supported, and remain necessary for
foreign (duck-typed) observables.

## PERFORMANCE 

One simple performance improvement builtin from the start is value caching for each signal.

Another performance improvementt that will still keep proper stack trace is to collect listeners
during update to SignalBag and firing them after SignalBag updates are done. That would cause a derived signal
that creates `fullNname` using `$signal.firstName` and `$signal.lastName` to be updated only once. Going broader than this could be useful, but also counter productive if it breaks stack trace visibility of value propagation.

postponing value evaluation is one way to reduce changes, and increase performance

`batch()` is that postponement, made explicit: inside it, computed signals settle once, in dependency
order, and no intermediate value reaches listeners.

- priority is to evaluate immediately to simplify reasoning.
- batching is opt-in as it is an optimisation
- provide means to do batching for critical paths
