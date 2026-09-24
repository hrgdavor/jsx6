/**
 * Runnable example: watching one signal with `traceSignal`.
 *
 * The `demo` region is what `doc/trace/usage.md` injects. A traced signal is a normal signal — the
 * graph flows through it — that also reports each activation to a log.
 */
import assert from 'node:assert/strict'
import { $C, signal, traceSignal, traceSignals } from '../../../index.js'

// Examples share one process, and tracing is process-wide; a real application opts in once, at startup.
traceSignals(false)
const wasTracing = traceSignals(true)

// #region demo
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
// #endregion demo

assert.match(seen[0], /^\[trace\] read computed sum = 3/)
assert.match(seen[1], /^\[trace\] read computed sum = 21/)
// Each activation is a short block: the value, then the facts the session attached.
assert.match(seen[0], /deps: \["a","b"\]/)
// `activations()` counts what the wrapper saw.
assert.equal($watched.activations(), 2)

// It is a drop-in signal: a computed can depend on it, and it still invalidates.
const $double = $C(() => $watched() * 2)
assert.equal($double(), 42)
$b(30)
assert.equal($double(), 62)
// Reading through the wrapper inside another computed does not count as a *user* activation, because
// the value was already memoized — the wrapper reports what its caller asked for, not internal reads.
assert.equal($watched.activations(), 3)
// `raw` is the signal it wrapped.
assert.equal($watched.raw, $sum)
assert.equal($watched.label, 'sum')

$watched.dispose()
traceSignals(wasTracing) // leave process-wide state as this example found it
