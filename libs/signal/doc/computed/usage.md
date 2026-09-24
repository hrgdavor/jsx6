# Using computed signals

Four additions to `@jsx6/signal`, and nothing removed. All samples on this page are injected from
runnable files in [`examples/`](./examples), executed by the package's own test suite.

## `$C` — lazy, memoized, auto-tracking

`$C(getValue)` evaluates the getter **on the first read** and caches the result until a dependency
changes. There is no dependency list: the reads that happen while the getter runs are the dependencies.

[examples/basic.js](./examples/basic.js#region:demo)

```js
const $a = signal(1)
const $b = signal(2)

let evaluations = 0
const $sum = $C(() => {
  evaluations++
  return $a() + $b()
})

// Nothing has run yet: a computed is lazy.
assert.equal(evaluations, 0)

$sum() // 3 — evaluated on the first read
$sum() // 3 — and then served from cache
assert.equal(evaluations, 1)

$a(10)
assert.equal($sum(), 12) // recomputed because a dependency changed
```

Three consequences worth internalising:

* a computed that nobody reads costs nothing — it is created, not evaluated;
* a write does **not** recompute a cold computed, it only marks it dirty; the next read does the work;
* because the getter is re-read on every recomputation, a dependency that only appears on a later
  evaluation (a `if` branch that flips) is picked up automatically.

## `$CE` — eager, auto-tracking

`$CE(getValue)` is the same computation with the old propagation timing: it evaluates at creation and
recomputes as soon as a dependency changes, whether or not anybody reads it. Use it when a value must
be correct before someone asks for it, or when you want auto-tracking without changing when your
listeners fire.

[examples/eager.js](./examples/eager.js#region:demo)

```js
const $a = signal(1)

let evaluations = 0
const $doubled = $CE(() => {
  evaluations++
  return $a() * 2
})

// Eager: the first evaluation happens at creation, not at the first read.
assert.equal(evaluations, 1)

$a(5)
// Still nobody has read it, and it is already up to date.
assert.equal(evaluations, 2)
assert.equal($doubled(), 10)
assert.equal(evaluations, 2)
```

`$CE(getValue, ...deps)` accepts an explicit dependency list as well; the declared signals and the
tracked reads are unioned, exactly as in `$S`/`$F`.

## `batch()` — several writes, one settled value

Inside `batch(fn)` a derived signal settles **once**, in dependency order, and no intermediate value
reaches a listener. Outside a batch every write propagates immediately, which is the library's default
and the reason stack traces stay useful.

[examples/batching.js](./examples/batching.js#region:demo)

```js
const $s = $State({ x: 1, y: 1 })
const $sum = $S(() => $s.x() + $s.y(), $s)

const seen = []
observe($sum, () => seen.push($sum()))

// Two writes outside a batch: the observer sees the intermediate value.
$s.x = 2
$s.y = 3

batch(() => {
  $s.x = 10
  $s.y = 20
})
```

A batch is exception safe: a callback that throws still closes the batch, and later writes propagate
normally. See [implementation.md](./implementation.md#batching) for how the pending queue is flushed.

## Computed signals over `$State`

`$State` presents each property as a signal and the whole object as an aggregate signal. A computed may
depend on either; depending on the aggregate (`$user()`) makes a multi-property update settle once,
while depending on children (`$user.firstName()`) is more precise about what invalidates.

[examples/state.js](./examples/state.js#region:demo)

```js
const $user = $State({ firstName: 'John', lastName: 'Doe' })

// Depend on two children.
const $fullName = $C(() => `${$user.firstName()} ${$user.lastName()}`)

// Or on the whole state, which fires once for any change to it.
const $initials = $C(() => ($user().firstName[0] ?? '') + ($user().lastName[0] ?? ''))

assert.equal($fullName(), 'John Doe')
assert.equal($initials(), 'JD')

mergeValue($user, { firstName: 'Jane', lastName: 'Smith' })
assert.equal($fullName(), 'Jane Smith')
```

`mergeValue` and `setValue` already wrap their work in a batch, which is why a merge that touches two
properties produces a single notification — see [changes.md](./changes.md#state).

## `dispose()` — release what a computed holds

A computed subscribes to its dependencies, and those subscriptions live as long as the computed. In a
long-lived component that is usually what you want; when it is not, `dispose($computed)` releases them.

[examples/dispose.js](./examples/dispose.js#region:demo)

```js
const $a = signal(1)

let evaluations = 0
const $expensive = $C(() => {
  evaluations++
  return $a() * 2
})

assert.equal($expensive(), 2)
assert.equal(evaluations, 1)

dispose($expensive)

// The dependency subscriptions are gone: changing `$a` no longer runs the getter.
$a(5)
assert.equal(evaluations, 1)
```

`dispose` is separate from unsubscribing an observer: `observe`/`observeNow` return an unsubscribe
function that removes **the listener**, while `dispose` removes the computed's **dependency
subscriptions**. Disposing a computed that is still being read is not an error — it simply recomputes
from scratch on the next read, because it is dirty and holds nothing.

## What a listener sees

Two rules, inherited from 1.8 and deliberately unchanged: notification is value-guarded with `===`, so
recomputing to an equal value wakes nobody; and propagation is synchronous, so a write is fully visible
on the next line.

[examples/notification.js](./examples/notification.js#region:value-guarded)

```js
const $n = signal(1)
const $parity = $C(() => ($n() % 2 === 0 ? 'even' : 'odd'))

let notifications = 0
observe($parity, () => notifications++)

$n(3) // recomputed: 'odd' -> 'odd'
assert.equal(notifications, 0) // same value, no notification

$n(4) // recomputed: 'odd' -> 'even'
assert.equal(notifications, 1)
```

That means `$C(() => 'even' or 'odd')` over a counter notifies on every *change of parity*, not on
every write — an easy way to cut DOM work without memoizing anything yourself.

## Inspecting signals in the dev console

A signal is a function, and that is the whole problem: **Chrome renders a function value as a clickable
source snippet and does not list the function's own properties**, so no property added to a signal is
visible there. There are two answers, in ascending order of cost — pick by how much you want bare
`console.log($sig)` to work.

### 1. Log the value — zero cost, works everywhere

[examples/inspect.js](./examples/inspect.js#region:demo)

```js
const $count = signal(1)

// The `value` getter is what tooling reads — a DevTools custom formatter, an inspector asked for hidden
// properties, Firefox's expanded view, or plain code like this:
$count.value // 1

// It is a getter, so it reports whatever the value is at the moment it is read:
$count(2)
$count.value // 2

// It works on computed signals too:
const $double = $C(() => $count() * 2)
$double.value // 4

// And it stays out of enumeration — `get` was already an enumerable key on every signal, `value` is not:
Object.keys($count) // ['get']
```

`$count.value` is a non-enumerable getter on every signal and computed, so `console.log($count.value)`
prints the number in every browser and in Node, with no settings. `$count()` gives the same thing and is
the supported read in application code.

Three properties of the getter, all deliberate:

* it is a **getter**, so the number you read is the current one — nothing is cached at log time.
* it is **non-enumerable**: `Object.keys`, spread, `for...in` and `JSON` are unaffected. (`get` was
  already an enumerable key on every signal; `value` deliberately does not join it.)
* reading a **lazy** `$C` evaluates it, exactly as calling it would — the console can make a cold computed
  warm, and that is a read like any other.

### 2. `installConsoleInspection()` — makes `console.log($sig)` itself readable

The console methods are wrapped so that a signal argument is replaced by a described object, while the
call site stays exactly as written:

```js
import { installConsoleInspection } from '@jsx6/signal'
if (import.meta.env?.DEV) installConsoleInspection()

console.log('count is', $count) // count is {signal: '$count', kind: 'signal', value: 5, read: ƒ, raw: ƒ}
```

* **no call-site change** — no wrapper to remember, no `.value` to type;
* **no cost on any signal path** — the wrapper runs only when something is logged;
* **nothing to enable** in DevTools, and it works in Node too.

`value` is read when the entry is logged (a snapshot, which is what a log line wants); `read()` gives the
current value at the moment you call it; `raw` is the signal itself, so nothing is lost. Non-signal
arguments are passed through untouched, the original methods stay reachable as `console.log.original`, and
`uninstallConsoleInspection()` puts everything back.

Both cores ship it, and `describeSignal($sig)` /
`signalLabel($sig)` (one-liner form, `signal $count = 5`) can be used on their own.

**The one trade-off**: a wrapped method moves DevTools' own "logged from" attribution to the wrapper, so
every entry would point at the library instead of your file. Two answers, both built in:
`installConsoleInspection({ showCallSite: true })` appends the real caller location as text, and
`console.log.original(...)` is there for the cases where DevTools' clickable source link matters more than
a readable value.

### Why there is no proxy mode

DevTools *does* run custom formatters for **proxy** values, and a proxy handle around a signal is
transparent (`typeof` still `'function'`; calls, `name`, `label`, `get`, the `Symbol.for` protocol,
`Object.keys` and every own property forward untouched). It was implemented, and then removed after being
measured:

| bench | plain signal | proxy handle | difference |
| --- | --- | --- | --- |
| 2M write+read | 26.75 ms | 349.93 ms | **+1208 %** |
| 3-deep eager chain (200k) | 18.17 ms | 101.18 ms | **+457 %** |
| 2M computed reads | 7.68 ms | 190.03 ms | **+2373 %** |

A trap on the read path costs about **13×** on a read-heavy loop — the whole point of this library is that
a read is a plain call — so it is not worth it for a debugging affordance. Console interception gives the
same result on screen for none of that cost, and `console.log($sig.value)` needs nothing at all.

### Two shapes whose getter is absent, and why

* **`$State`** is a proxy, not a signal, so `$s.value` is not the snapshot — reading any unknown key of a
  state proxy hands back a lazily created child signal. Inspect a field with `$s.field.value`, or print
  the whole state: `$s()` returns the snapshot object, and `String($s)` / `` `${$s}` `` return its JSON
  form. (That coercion used to throw `TypeError: Symbol.toPrimitive returned an object`, in every core
  since 1.8.18; it is fixed — see [changes.md](./changes.md#five-defects-the-effort-found-and-fixed).)
* **`staticSignal`**, the constant wrapper `asSignal` uses for plain values, keeps its minimal shape: it
  is created on warm paths, has nothing to recompute, and `$static.get()` / coercion already expose the
  value. `$sig.value` on a signal or computed is the console affordance.

Both cores expose it identically — `@jsx6/signal` and `@jsx6/signal-alien` — so the inspection
experience does not depend on which one a project uses.

There is a page for this: [`experiments/signal-inspect`](../../../../experiments/signal-inspect/README.md)
serves a demo with one signal of every shape on both cores, already logged to the console, plus buttons
for the snapshot-vs-getter difference, the enumeration facts and the cycle report —
`bun experiments/signal-inspect/serve.js`.
