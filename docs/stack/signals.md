# Signals: the reactivity core

`@jsx6/signal` is small on purpose, and its one unusual decision explains most of the rest: **a signal is
a function**.

```js
const $count = signal(0)

$count()        // read
$count(5)       // write → true when the value changed, undefined when it did not
$count.value    // the same read, for the dev console
```

Values propagate **immediately and synchronously** inside the write call, so a stack trace still shows
which write caused which update. There is no scheduler to wait for, and no batching unless you ask for it
with `batch()`.

[signals.example.mjs](./signals.example.mjs#region:demo)

```js
// A signal is a function: call it with no argument to read, with a value to write.
const $count = signal(1)

// $S is eager and tracks the signals its callback reads (on top of the ones you declare). It needs at
// least one dependency to be a derived signal at all: `$S(fn)` with a single argument stores the
// function itself as the value.
const $double = $S(() => $count() * 2, $count)
$count(5)
assert.equal($double(), 10) // recomputed inside the write call, no scheduler involved

// $C is lazy and memoized: it computes on the first read, and again only when a dependency changed.
const $sum = $C(() => $count() + $double())

// $State is one signal per field behind a proxy, so reads and writes look like properties.
const $user = $State({ first: 'Ada', last: 'Lovelace' })

// observeNow runs the callback immediately and on every change; observe waits for the first change.
const nowLog = []
const laterLog = []
const stopNow = observeNow($count, v => nowLog.push(v))
const stopLater = observe($double, () => laterLog.push($double()))
```

Run it: `node docs/stack/signals.example.mjs` (no DOM involved).

## The API you will actually use

| export | signature | what it does |
| --- | --- | --- |
| `signal` | `signal(value, name?)` | the primitive; the optional name sets `.label`/`.name` for debugging |
| `$S` | `$S(fn, ...deps)` | **eager** derived signal; recomputes on every dependency change |
| `$F` | `$F(filter, ...deps)` | the same, with the dependency values passed to `filter(...)` |
| `$C` | `$C(fn, ...deps)` | **lazy**, memoized, auto-tracking derived signal |
| `$CE` | `$CE(fn, ...deps)` | eager auto-tracking derived signal |
| `$State` | `$State(initial)` | a proxy of one signal per field; callable for a snapshot |
| `mergeValue` | `mergeValue($state, patch)` | patch the fields present in `patch`; returns whether anything changed |
| `batch` | `batch(fn)` | settle derived signals once, at the end; returns `fn`'s value |
| `dispose` | `dispose($computed)` | release a computed's dependency subscriptions |
| `observe` | `observe($sig, cb, trigger = false)` | subscribe; `cb` gets the current value, but is not called at subscribe time |
| `observeNow` | `observeNow($sig, cb)` | subscribe and call `cb` immediately |
| `subscribe` | `subscribe($sig, cb, trigger = false)` | subscribe; `cb` is always called with **no** arguments |
| `asSignal` | `asSignal(valueOrObservable)` | a signal, a promise or an observable → a signal |
| `signalValue` | `signalValue($sig)` | `$sig()` for a function, the value otherwise |

`observe`/`observeNow`/`subscribe` return the unsubscribe function (or `undefined` for a value that is
not a signal). Derived helpers — `$NOT`, `$BOOL`, `$If`, `$Map`, `$Any`, `$Or`/`$OrB`, `$And`/`$AndB`,
`$EQ`/`$EQX`, `$NEQ`/`$NEQX` — are in the [package reference](../../libs/signal/README.md); the doc
pages under [libs/signal/doc/computed](../../libs/signal/doc/computed/README.md) cover the computed axis
in depth.

## The rules that matter

**A derived signal needs at least one dependency.** `$S(fn)` with a single argument is `signal(fn)` — the
function becomes the *value*, not a computation. Use `$S(fn, $dep)`, or `$C(fn)`/`$CE(fn)` for
auto-tracking without a dependency list.

**Dependencies are the union of what you declare and what the callback reads.** `$S(() => $a() + $b(), $a)`
still recomputes when `$b` changes; declaring a dependency the callback never reads also keeps working.
What cannot be tracked, because it is not this library's signal, has to be declared: duck-typed signals
(such as the translation signal `$T` in `@jsx6/jsx6`), promises and observables.

**Reads are collected once when a dependency list exists.** With declared dependencies the dependency set
is built on the first evaluation, so a signal that is only read inside a branch that appears later must be
declared. `$C`/`$CE` without declared dependencies re-collect on every recomputation and follow the branch.

**`$C` is lazy, `$CE` is eager.** A `$C` computes on the first read and again only when a dependency it
read has changed (an equal result notifies nobody); a `$CE` recomputes whether or not anybody reads it.
Writing to a computed is a no-op.

**`batch()` is the only coalescing.** Outside it, two writes are two notifications and the intermediate
value is visible. Inside it, derived signals settle once, in dependency order, and only the final value
reaches listeners. `$State` updates use it internally, which is why one `mergeValue` of three fields
notifies a derived signal once.

**`$State` fields are signals; the state is an aggregate.** `$s.x()` reads, `$s.x = v` writes, `$s()` is a
snapshot object, `$s(obj)` replaces all fields and resets the ones missing from `obj` to `undefined`,
`mergeValue` only touches the keys you pass. The state also answers `observe`/`observeNow` as one
aggregate.

**Subscriptions are yours to release.** `observe`/`observeNow`/`subscribe` return the unsubscribe
function; nothing releases it for you. `dispose($computed)` releases a computed's dependency
subscriptions (only computeds have it).

## Traps

| trap | what happens |
| --- | --- |
| `$S(fn)` with one argument | stores the function as the value — no computation, no reactivity |
| `$sig(undefined)` | a **write** of `undefined`, not a read (use `$sig()` or `.value`) |
| mutating an object inside a signal | invisible: the guard is `===`, so only a new reference notifies. `NaN` is never equal to itself, so writing `NaN` always notifies |
| reading an unknown `$State` key | **creates** that field: `$s.missing` adds `missing` to the state (so `$s.value`, `$s.dispose` and typos become fields) |
| `observeNow(0, cb)` | a falsy static is dropped before the guard, so `cb` receives `undefined` |
| observing a promise or an observable | supported, but no unsubscribe is returned for it |
| `$F(fn, oneNonSignal)` | `$F` silently degrades to a static value; it filters only when it has more than one dependency or an observable one |
| `$If($sig, a, b)` | returns the branch raw and never reads it — signal branches give you a signal-valued signal |
| `$Or`/`$And` | return the operand, not a boolean (`$OrB`/`$AndB` coerce) |
| `$EQ`/`$NEQ` | loose equality; `$EQX`/`$NEQX` are the strict ones. The argument order is `(to, $signal)` |

## Debugging a signal in the console

A signal is a function, and DevTools renders a function value as a source snippet — it shows none of its
properties. Three answers, cheapest first:

* `console.log($count.value)` — a non-enumerable getter on every signal and computed. Reading it on a
  lazy `$C` evaluates that computed.
* `installConsoleInspection()` once in dev: console arguments that are signals are replaced by a
  described object (`{signal: '$count', kind: 'signal', value: 5, read: ƒ, raw: ƒ}`) without touching
  your call sites.
* `traceSignal($sig, { label: 'count' })` and `traceSignals()` for one signal's activations, creation
  site, listener set and a computed's getter. Both are opt-in and inert while off.

Full guide: [libs/signal/README.md](../../libs/signal/README.md) and
[doc/trace/usage.md](../../libs/signal/doc/trace/usage.md).

## Cost

The package has **no dependencies**, and the computed/batching/tracking axis adds **+1.0 kB gzip** to a
bundle that uses the core API (minified 2.4 → 4.8 kB). The measurement and the alternatives are in
[experiments/signal-directions](../../experiments/signal-directions/USAGE-AND-SIZE.md).

Next: [components.md](./components.md) — how signal values reach the DOM.