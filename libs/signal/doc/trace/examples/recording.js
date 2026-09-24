/**
 * Runnable example: choosing what to record, and filtering a wrapper's output.
 *
 * The `demo` region is what `doc/trace/usage.md` injects. `max` and `only` keep a wrapper quiet; a
 * session-level `origin: false` makes tracing cheap enough for a longer run.
 */
import assert from 'node:assert/strict'
import { $C, signal, traceSignal, traceSignals } from '../../../index.js'

// #region demo
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
// #endregion demo

assert.equal(seen.filter(l => l.includes('read')).length, 0)
assert.equal(seen.filter(l => l.includes('write')).length, 2)
// Each report is a short block: the one-line summary, then origin and listener count.
assert.match(seen[0], /^\[trace\] write signal count = 1/)
assert.match(seen[1], /^\[trace\] write signal count = 2/)
assert.match(seen[2], /2 activations reported, going quiet/)

// `max` silences the console only; `onActivate` sees every activation, so a counter or a test can still
// observe it after the noise stops.
const activations = []
const $counted = traceSignal($count, { label: 'counted', max: 1, onActivate: info => activations.push(info) })
$counted(4)
$counted(5)
assert.deepEqual(
  activations.map(a => ({ activation: a.activation, label: a.label, kind: a.kind, count: a.count })),
  [
    { activation: 'write', label: 'counted', kind: 'signal', count: 1 },
    { activation: 'write', label: 'counted', kind: 'signal', count: 2 },
  ],
)

// A session is what attaches the internals (creation site, listener set, dependencies). `origin: false`
// skips the stack capture — the expensive part — when only the graph matters. Options belong to the
// session: a later `traceSignals()` restores the defaults, so nothing here leaks into the next session.
traceSignals(false)
const wasTracing = traceSignals({ origin: false })
const $a = signal(1, 'a')
const $sum = $C(() => $a() + 1, 'sum')
$sum()
const $traced = traceSignal($sum, { label: 'sum', max: 0 })
const snapshot = $traced.snapshot()
assert.equal(snapshot.origin, undefined) // not captured
assert.deepEqual(snapshot.deps, ['a']) // still collected
traceSignals(false)
assert.deepEqual(snapshot.deps, ['a']) // still collected

$writes.dispose()
$counted.dispose()
$traced.dispose()
traceSignals(wasTracing) // leave process-wide state as this example found it
