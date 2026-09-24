# Tracing a signal

`@jsx6/signal` has three debugging tools, and they answer different questions:

| tool | question | cost |
| --- | --- | --- |
| `console.log($sig.value)` | *what is this signal's value?* | none |
| `installConsoleInspection()` | *what is this value, when I already logged it?* | none |
| **`traceSignal($sig)`** | *when is this signal read or written, and from where?* | one call per activation of that signal |
| **`traceSignals()`** | *where did this signal come from, what does it depend on, who depends on it?* | a record per signal created while it is on |

Everything on this page is opt-in. A signal created while tracing is off carries **no extra property**,
and nothing is captured; the read, write, notify and subscribe paths are untouched.

---

## 1. Watching one signal: `traceSignal`

Wrap the signal you care about. The wrapper is a drop-in signal — `subscribe`, `trigger`, primitives and
the `value` getter all delegate — so the graph keeps working through it.

[examples/watch.js](./examples/watch.js#region:demo)

```js
const $a = signal(1, 'a')
const $b = signal(2, 'b')
const $sum = $C(() => $a() + $b(), 'sum')

const seen = []
const $watched = traceSignal($sum, {
  label: 'sum',
  log: (...line) => seen.push(line.join(' ')), // defaults to console.log
  max: 3, // dumps after this many activations, then goes quiet
})

$watched() // [trace] read computed sum = 3
$b(20) // the computed is lazy: no activation yet
$watched() // [trace] read computed sum = 21
```

Each report is a short block:

```
[trace] read computed sum = 21  depth=1
        origin: /app/src/cart.js:24:18
        deps: ["a","b"]
        listeners: 1
```

What activates a wrapper:

* a **read** — somebody asked for the value;
* a **write that actually changed the value** — the library's `===` guard is the signal's own truth, so a
  write that changed nothing reports nothing. That asymmetry is usually the answer to "I set it and
  nothing happened".

A wrapper reports what its caller asked for. Reads that happen *inside* another computed's recomputation
are not reported as activations, because the wrapper is not what that computation called.

### Options

| option | default | meaning |
| --- | --- | --- |
| `label` | the signal's own label | what the reports call it |
| `log` | `console.log` | any sink: a test can collect lines instead of printing them |
| `warn` | `false` | use `console.warn`, so DevTools attributes the entry to a call site |
| `trace` | `false` | `console.trace` per activation, when you want the full stack |
| `only` | `'both'` | `'read'` or `'write'` to filter one kind out |
| `max` | `5` | reports before going quiet (`0` = never print, still record) |
| `getter` | — | for a bare function: the reference to report as the source |
| `onActivate` | — | called on **every** activation, including after `max` |

### The wrapper object

| member | what it is |
| --- | --- |
| `$w()` / `$w(value)` | read / write — the signal itself |
| `$w.raw` | the signal that was wrapped |
| `$w.label`, `$w.kind` | `'signal'`, `'computed'` or `'$State'` |
| `$w.activations()` | how many activations it has reported |
| `$w.snapshot()` | a plain object describing it (below) |
| `$w.show()` | logs `snapshot()` and returns it |
| `$w.describe()` | the one-line text report |
| `$w.dispose()` | stops the reports (and releases a state's write observer) |

---

## 2. Getting a clickable source reference

This is the reason `snapshot()`/`show()` log an *object* rather than a string.

A signal is a function, and DevTools renders a function value as source text: it lists none of the
function's own properties and does not run custom formatters for functions. So `console.log($sig)` can
never show you the value — and clicking it takes you to the signal's own body, not to your computation.

Logging a **plain object** whose `getter` is your compute function gives DevTools an enumerable property
to render, and it draws that as a clickable `getter: ƒ totalWithTax` that jumps to the definition:

[examples/source-ref.js](./examples/source-ref.js#region:demo)

```js
const $price = signal(3, 'price')
const $tax = signal(1, 'tax')

// A *named* function is what makes the console line read `getter: ƒ totalWithTax` and click through to
// the source; an arrow assigned to a const keeps whichever name the engine inferred, and an inline
// arrow has none at all.
function totalWithTax() {
  return $price() + $tax()
}

const $total = traceSignal($C(totalWithTax), { label: 'total', max: 0 })

$total() // evaluate it, so the dependency list is complete
const snapshot = $total.snapshot()
// {
//   signal: 'total', kind: 'computed', value: 4, origin: '…/checkout.js:12:18',
//   deps: [ 'price', 'tax' ], getter: ƒ totalWithTax, listeners: 0, raw: ƒ $computed
// }
```

The snapshot fields:

| field | meaning |
| --- | --- |
| `signal` | the label |
| `kind` | `signal`, `computed`, `$State` |
| `value` | the current value, or `⚠ message` if reading it throws |
| `depth` | the graph depth a computed reports (`undefined` otherwise) |
| `origin` | `file:line:col` of the creation site, when a session captured it |
| `deps` | dependency *names* — read-derived for a computed, child names for a `$State` |
| `getter` | the compute function — **the clickable reference** |
| `listeners` | how many listeners the signal has right now |
| `raw` | the unwrapped signal |

To wrap a computation that is not a signal yet, pass the getter:

```js
const $named = traceSignal(() => $price() * 10, { label: 'priceX10', getter: totalWithTax, max: 0 })
```

---

## 3. Tracing a `$State`

A state field is written as `$s.field = 5`, which the proxy's `set` trap performs on the **raw child
signal**. So a wrapper around `$s.field` — or around the state — would never see it, and a state is the
one case that needs help. That help is one guarded line in the trap, inert until something observes.

[examples/state.js](./examples/state.js#region:demo)

```js
const seen = []
const log = (...line) => seen.push(line.join(' '))

const $cart = traceSignal($State({ count: 0, note: 'new' }), { label: 'cart', log, max: 20 })

$cart.count = 1 // a field assignment through the proxy
mergeValue($cart, { count: 2 }) // one report per changed field
$cart({ count: 3 }) // the callable setter; `note` is absent, so it resets to undefined

// A read reports the whole snapshot, and the children are the dependencies:
$cart() // [trace] read $State cart = {"count":3}   deps: ["count","note"]
```

which reports:

```
[trace] write $State cart.count = 1
[trace] write $State cart.count = 2
[trace] write $State cart.count = 3
[trace] write $State cart.note = undefined
```

Every state write path is covered: `$s.field = v`, `mergeValue($s, {...})`, `$s({...})`, and the
reset-to-`undefined` that `setValue` performs for fields missing from the patch. Only changed fields are
reported — `mergeValue` with a value the field already had reports nothing.

The wrapper is transparent to the graph: a computed over the state still invalidates normally:

```js
const $double = $C(() => $cart.count() * 2, 'double')
$cart.count = 4
$double() // 8
```

Call `$cart.dispose()` when you are done: it unregisters the observer, so a long-lived page does not
accumulate one per traced state.

### `onStateWrite`, the primitive underneath

If you want the raw events rather than a wrapper's report:

```js
const stop = onStateWrite((child, value) => {
  console.log(child.label, '=', value) // child is the raw child signal
})
// ...
stop()
```

`hasStateWriteObservers()` reports whether anything is observing — the condition the trap tests.

---

## 4. What the session knows: `traceSignals`

A wrapper reports what happens at *its* signal. A session attaches the facts only the signal
implementation has — where a signal was created, who listens to it, and (for a computed) the function it
was built from and what it depends on.

[examples/session.js](./examples/session.js#region:demo)

```js
const $a = signal(1, 'a') // created while tracing is on, so its record is complete
const $b = signal(2, 'b')

// A named function is what gives the `getter` reference a name in the console. An inline arrow has
// none, so `getter.name` is '' — the function is still clickable, just unlabelled.
function sumAB() {
  return $a() + $b()
}
const $sum = $C(sumAB, 'sum')
$sum() // a lazy computed collects its dependencies when it evaluates

signalTrace($a).origin.text // '…/checkout.js:17:12' — where this signal was created
signalTrace($a).listeners.size // 1 — the computed subscribed to it
signalTrace($sum).getter // ƒ sumAB — the reference DevTools renders clickable
signalTrace($sum).deps() // { tracked: [$a, $b], declared: [] }

// `tracked` and `declared` are reported separately, because they answer different questions: what this
// evaluation actually read, and what the call site promised to depend on.
const $declared = $C(() => $a(), $b)
$declared()
signalTrace($declared).deps() // { tracked: [$a], declared: [$b] }

traceSignals(false) // stop attaching records to new signals; existing ones keep theirs
```

| export | what it does |
| --- | --- |
| `traceSignals(on?)` | opt in or out; returns the previous state |
| `signalsTraced`, `traceOptions` | the flag and the active session's options |
| `signalTrace($s)`, `metaSymbol` | the record of a signal, or `undefined` |
| `ensureTrace($s)` | attach a record to a signal created before the session |
| `captureSite()`, `captureFrom(stack)` | a `file:line:col` site, parsed into `file`/`line`/`column`/`raw` |
| `describeName($s)` | a printable name without triggering a getter |

Records are attached when a signal is **created**, so:

* start the session **before** creating what you want complete records for;
* `traceSignal($sig)` covers a signal that already exists by retrofitting a record — but a retrofitted
  record has the creation site only, because a computed's getter and a signal's listener set are
  create-time facts;
* a computed built *before* the session has no `deps` and no `getter` to report. Wrap it and use
  `depsOf`-free reporting, or start the session earlier.

### Session options

| option | default | meaning |
| --- | --- | --- |
| `origin` | `true` | capture a creation site per signal. This is the expensive part of a session |
| `listeners` | `true` | attach the live listener set |

[examples/recording.js](./examples/recording.js#region:demo)

```js
const $count = signal(0, 'count')

// Only writes, and only the first two of them:
const seen = []
const $writes = traceSignal($count, {
  label: 'count',
  only: 'write',
  max: 2,
  log: (...line) => seen.push(line.join(' ')),
})

$writes() // a read: filtered out by `only: 'write'`
$writes(1) // [trace] write signal count = 1
$writes(2) // [trace] write signal count = 2
$writes(3) // reported to `onActivate`, but silent on the console — `max` was reached
```

Options belong to a session. `traceSignals()` — with no argument — starts one **with the defaults
restored**, so an earlier `{origin: false}` cannot silently degrade a later session. That is deliberately
different from `traceSignals(false)`, which only turns tracing off.

---

## 5. What it costs

Measured against a control copy of the previous revision, in one process, rotating order, best of 40
samples (`experiments/signal-probe/bench-hooks.mjs`, `bench-state-trap.mjs`):

| path | tracing **off** |
| --- | --- |
| create a named signal (50k) | −1.0 % median |
| create an anonymous signal (50k) | +0.8 % median |
| write + read a signal (50k) | +3.2 % median (untouched code — this is noise) |
| `$State` field write (200k) | −1.0 % median |
| `$State` `mergeValue` (200k) | +0.6 % median |
| `$State` `setValue` (200k) | +0.6 % median |

One empty function call calibrates at ~12 ns on the same machine, so the added hooks are below the
measurement's resolution: **nothing is paid until you ask**.

When tracing **is** on, a session costs roughly 10× on signal *creation* — one record per signal, and the
property definition is the expensive part, not the stack walk. So:

* use `traceSignal` on specific signals for a running app;
* use a session for a repro, and `{origin: false}` when you only want the graph.

---

## 6. Limits worth knowing

* **A wrapper sees only its own activations.** Reads inside another computed's recomputation are not
  reported; that read still invalidates the computed normally.
* **`$State` writes through the proxy are reported; writes to a child signal you kept are not.** If you
  stored `const $n = $s.count` earlier, `$n(5)` bypasses the proxy — wrap that signal instead.
* **A signal created before the session has a site-only record**, and a computed created before it has no
  `deps`/`getter`. Start the session earlier for complete records.
* **`getter` is the function you passed.** An arrow has no name; a named function shows its name.
* **Sites are minified in a production bundle.** Source maps resolve them in DevTools, not in the strings
  a record holds. Trace against an unbundled dev build when the line matters.
* **A throwing getter still throws from a read** — that is the library's own contract
  (`computed-errors.test.js`). `snapshot()` reports it as `⚠ message` instead.
* **Records outlive a session** on the signals that already have them; `traceSignals(false)` only stops
  attaching new ones.
