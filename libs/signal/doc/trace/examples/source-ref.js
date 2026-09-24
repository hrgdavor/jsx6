/**
 * Runnable example: turning a traced signal into a clickable source reference.
 *
 * The `demo` region is what `doc/trace/usage.md` injects. A signal is a function, and DevTools renders
 * a function value as source text without listing its properties — so `show()` logs a *plain object*
 * whose `getter` is the compute function, which DevTools does expand.
 */
import assert from 'node:assert/strict'
import { $C, signal, traceSignal, traceSignals } from '../../../index.js'

// Ask for tracing *before* creating what will be traced. `traceSignal` covers a signal that already
// exists (`ensureTrace` retrofits a record), but a computed's dependency set and getter are attached as
// it is *created* — so a computed built before the session has nothing to retrofit.
const previous = traceSignals()

// #region demo
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
// #endregion demo

assert.equal(snapshot.signal, 'total')
assert.equal(snapshot.kind, 'computed')
assert.equal(snapshot.value, 4)
// `deps` are the *names*, and they are only complete once the computed has evaluated — a lazy signal
// has no dependencies until it runs.
assert.deepEqual(snapshot.deps, ['price', 'tax'])
// The whole point: the reference DevTools will render as `getter: ƒ totalWithTax`, clickable to source.
assert.equal(snapshot.getter, totalWithTax)
assert.equal(snapshot.getter.name, 'totalWithTax')
assert.equal(typeof snapshot.raw, 'function')
// The creation site is the real file and line where tracing first saw the signal.
assert.match(snapshot.origin, /source-ref\.js:\d+:\d+/)

// `show()` logs that same object and returns it — it is `snapshot()` plus the console line.
const logged = $total.show()
assert.deepEqual(logged, snapshot)

// Wrapping a bare getter names the reference directly, when the computation is not a signal yet.
const $named = traceSignal(() => $price() * 10, { label: 'priceX10', getter: totalWithTax, max: 0 })
assert.equal($named.snapshot().getter, totalWithTax)

$total.dispose()
$named.dispose()
traceSignals(previous) // leave process-wide state as this example found it
