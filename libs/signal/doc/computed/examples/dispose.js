/**
 * Runnable example: `dispose()` — releasing a computed's dependency subscriptions.
 *
 * Long-lived components are the reason this exists: a computed that is no longer needed should stop
 * holding its dependencies, and `observe`/`observeNow` unsubscribes only the listener, not the computed.
 */

import assert from 'node:assert/strict'
import { $C, $S, dispose, observe, signal } from '../../../index.js'

// #region demo
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
// #endregion demo

// `dispose` is tolerant: a plain signal, a missing value, or a computed that owns nothing.
const $plain = signal(1)
dispose($plain)
dispose(undefined)
dispose($C(() => $a()))
assert.equal(typeof dispose, 'function')

// Unsubscribing an observer is a separate concern: it removes the listener, the computed stays.
const $derived = $S(() => $a() + 1, $a)
const seen = []
const unsubscribe = observe($derived, () => seen.push($derived()))
$a(6)
assert.deepEqual(seen, [7])
unsubscribe()
$a(7)
assert.deepEqual(seen, [7])
