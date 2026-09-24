/**
 * Runnable example: the session API — what a trace knows about the graph.
 *
 * The `demo` region is what `doc/trace/usage.md` injects. A wrapper reports what happens at *its*
 * signal; a session attaches the facts that only the signal implementation has: the creation site, the
 * live listener set, and a computed's getter and dependencies.
 */
import assert from 'node:assert/strict'
import { $C, metaSymbol, signal, signalTrace, traceSignals } from '../../../index.js'

// A real application opts in once, at startup. An example has to put the process back the way it found
// it, because `traceSignals()` reports the previous state and the examples share one process.
const wasTracing = traceSignals()

// #region demo
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
// #endregion demo

const $c = signal(3, 'c')
assert.equal(signalTrace($c), undefined) // created after the session ended
assert.equal(typeof wasTracing, 'boolean')

// A record is a plain, enumerable object, which is what makes it useful in a console:
assert.equal($a[metaSymbol].kind, 'signal')
assert.equal($sum[metaSymbol].kind, 'computed')
assert.equal($a[metaSymbol].origin.file.endsWith('session.js'), true)
assert.match($a[metaSymbol].origin.text, /session\.js:\d+:\d+/)
assert.ok($a[metaSymbol].origin.raw.includes('session.js'))
assert.equal($sum[metaSymbol].getter, sumAB)
assert.equal($sum[metaSymbol].getter.name, 'sumAB')

// `deps()` was read above while the session was live: records are attached at creation, so a computed
// made after `traceSignals(false)` has none.
assert.deepEqual(signalTrace($declared).deps().tracked, [$a])
assert.deepEqual(signalTrace($declared).deps().declared, [$b])

// Enabling it is a boolean test on creation paths; nothing is captured until someone asks.
assert.equal(typeof traceSignals, 'function')
traceSignals(wasTracing) // leave process-wide state as this example found it
