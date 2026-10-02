/**
 * Runnable example: the signal half of the stack (`@jsx6/signal`).
 *
 * The `demo` region is what `docs/stack/signals.md` injects; everything outside it is the check that
 * keeps the sample honest. No DOM is involved, so it runs under plain Node from the repository root:
 *
 *   node docs/stack/signals.example.js
 *
 * The file is named `*.example.js` (not `*.test.js`) on purpose: it is documentation that happens to
 * assert, not part of the package test suites.
 */
import assert from 'node:assert/strict'

import {
  $C,
  $F,
  $S,
  $State,
  asSignal,
  batch,
  dispose,
  mergeValue,
  observe,
  observeNow,
  signal,
  subscribe,
} from '@jsx6/signal'

// #region demo
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
// #endregion demo

// ------------------------------------------------------------------------------------------------
// The demo above is deliberately small; the rest of this file pins the rules the page states.
// ------------------------------------------------------------------------------------------------

// Writes report whether anything actually changed: `true` on a change, `undefined` otherwise.
assert.equal($count(6), true)
assert.equal($count(6), undefined) // === guard: same value, nothing is notified
assert.deepEqual(nowLog, [5, 6]) // observeNow's immediate call, then the change
assert.deepEqual(laterLog, [12]) // $double recomputed on the change of $count that followed

// A signal is not a value, it is a function that returns one. `.value` is the console shortcut.
assert.equal(typeof $count, 'function')
assert.equal($count.value, 6)
assert.equal($sum(), 18) // 6 + 12
assert.equal($user.first(), 'Ada') // a $State field is a plain child signal

// The union rule: $S/$F keep the dependencies you declare AND track the signals the callback reads.
const $a = signal(1)
const $b = signal(2)
const $union = $S(() => $a() + $b(), $a) // $b is tracked although it is not declared
$b(20)
assert.equal($union(), 21)

// $F is the filter form: the filter receives the current values of the listed signals.
const $isEven = $F(v => v % 2 === 0, $count)
assert.equal($isEven(), true)

// $C memoizes: the getter runs once, and again only when a dependency it read has changed.
let evaluations = 0
const $memo = $C(() => {
  evaluations++
  return $count() * 10
})
assert.equal(evaluations, 0) // lazy: nothing runs at creation
assert.equal($memo(), 60)
assert.equal($memo(), 60)
assert.equal(evaluations, 1)
$count(7)
assert.equal($memo(), 70)
assert.equal(evaluations, 2)

// Without batch(), every write propagates on its own; batch() settles the group once.
const seen = []
const $ab = $S(() => $a() + $b(), $a, $b)
observe($ab, () => seen.push($ab()))
assert.equal($ab(), 21) // 1 + 20, and observe() has not called back yet
$a(2) // 2 + 20
$b(2) // 2 + 2 — two notifications, the intermediate value is visible
assert.deepEqual(seen, [22, 4])
batch(() => {
  $a(10)
  $b(20)
})
assert.deepEqual(seen, [22, 4, 30]) // one notification, only the settled value

// $State: the state itself is an aggregate, and a multi-field update settles a computed once.
const $point = $State({ x: 1, y: 1 })
const $label = $C(() => `${$point.x()},${$point.y()}`)
const labels = []
observe($label, () => labels.push($label()))
assert.equal($label(), '1,1')

$point.x = 2 // property write
assert.equal($point.x(), 2)
assert.deepEqual($point(), { x: 2, y: 1 }) // $state() is a snapshot object, not a signal

mergeValue($point, { x: 3, y: 3 }) // patch: only the keys you pass are touched
assert.deepEqual($point(), { x: 3, y: 3 })
assert.deepEqual(labels, ['2,1', '3,3'])

// Reading an unknown key on the proxy CREATES that field — a typo becomes part of the state.
const $typo = $State({ ok: 1 })
assert.equal($typo.missing(), undefined)
assert.deepEqual(Object.keys($typo()), ['ok', 'missing'])

// observe / observeNow / subscribe differ in when they first run and what the callback receives.
const events = []
const unObserve = observe($a, v => events.push(['observe', v]))
const unNow = observeNow($a, v => events.push(['now', v]))
const unSubscribe = subscribe($a, (...args) => events.push(['subscribe', args.length]))
assert.deepEqual(events, [['now', 10]]) // only observeNow ran immediately
$a(11)
assert.deepEqual(events, [
  ['now', 10],
  ['observe', 11],
  ['now', 11], // observeNow also calls back on every change
  ['subscribe', 0], // subscribe never passes a value
])

// Every subscription is yours to release; nothing is released automatically.
unObserve()
unNow()
unSubscribe()
$a(12)
assert.equal(events.length, 4)

// dispose() releases a computed's dependency subscriptions. A plain signal has nothing to release.
const $dep = signal(1)
const $derived = $C(() => $dep() * 2)
assert.equal($derived(), 2)
assert.equal(typeof $derived.dispose, 'function')
dispose($derived)
assert.equal(dispose($dep), undefined) // tolerated: no-op for a signal

// Interop: a promise or an observable becomes a signal; it is an adapter, not a new signal type.
const $resolved = asSignal(Promise.resolve(42))
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal($resolved(), 42)

stopNow()
stopLater()
$count(100)
assert.ok(!nowLog.includes(100)) // unsubscribed: nothing observes $count any more
console.log('signals example: all assertions passed')