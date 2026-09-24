/**
 * Runnable example: tracing a `$State`.
 *
 * The `demo` region is what `doc/trace/usage.md` injects. A state write goes through the proxy's `set`
 * trap onto the raw child signal, so it is the one case a wrapper cannot see by itself — this is what
 * the state support reports.
 */
import assert from 'node:assert/strict'
import { $C, $State, mergeValue, traceSignal, traceSignals } from '../../../index.js'

// Examples share one process, and tracing is process-wide; a real application opts in once, at startup.
traceSignals(false)
const wasTracing = traceSignals(true)

// #region demo
const seen = []
const log = (...line) => seen.push(line.join(' '))

const $cart = traceSignal($State({ count: 0, note: 'new' }), { label: 'cart', log, max: 20 })

$cart.count = 1 // a field assignment through the proxy
mergeValue($cart, { count: 2 }) // one report per changed field
$cart({ count: 3 }) // the callable setter; `note` is absent, so it resets to undefined

// A read reports the whole snapshot, and the children are the dependencies:
$cart() // [trace] read $State cart = {"count":3}   deps: ["count","note"]
// #endregion demo

assert.deepEqual(
  seen.filter(l => l.includes('write')).map(l => l.replace(/\n.*/s, '')),
  [
    '[trace] write $State cart.count = 1',
    '[trace] write $State cart.count = 2',
    '[trace] write $State cart.count = 3',
    '[trace] write $State cart.note = undefined',
  ],
)

// The snapshot is the value the state reports. A field reset by `setValue` stays as `undefined` — the
// state does not drop the key — so the snapshot shows it.
assert.deepEqual($cart(), { count: 3, note: undefined })
assert.deepEqual($cart.snapshot().deps, ['count', 'note'])

// Unchanged writes report nothing — the === guard is the signal's own truth.
const before = seen.length
$cart.count = 3
assert.equal(seen.length, before)

// The wrapper is transparent to the graph: derived values invalidate as usual.
const $double = $C(() => $cart.count() * 2, 'double')
assert.equal($double(), 6)
$cart.count = 4
assert.equal($double(), 8)

$cart.dispose()
traceSignals(wasTracing) // leave process-wide state as this example found it
