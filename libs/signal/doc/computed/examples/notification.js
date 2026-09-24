/**
 * Runnable example: what a listener sees.
 *
 * Two rules, both inherited from 1.8 and deliberately unchanged:
 *   - notification is value-guarded with `===`, so recomputing to the same value wakes nobody;
 *   - propagation is synchronous, so a write is fully visible on the next line.
 */

import assert from 'node:assert/strict'
import { $C, $S, observe, observeNow, signal } from '../../../index.js'

// #region value-guarded
const $n = signal(1)
const $parity = $C(() => ($n() % 2 === 0 ? 'even' : 'odd'))

let notifications = 0
observe($parity, () => notifications++)

$n(3) // recomputed: 'odd' -> 'odd'
assert.equal(notifications, 0) // same value, no notification

$n(4) // recomputed: 'odd' -> 'even'
assert.equal(notifications, 1)
// #endregion value-guarded

// #region synchronous
const $a = signal(1)
const $b = $S(() => $a() * 10, $a)
const seen = []
const unsubscribe = observeNow($b, v => seen.push(v))

assert.deepEqual(seen, [10]) // observeNow calls back immediately
$a(2)
assert.deepEqual(seen, [10, 20]) // and synchronously on the write, before the next statement
unsubscribe()
// #endregion synchronous

// observe() is the deferred-value form: no immediate call, value pulled by the listener.
const $c = signal(1)
const $d = $S(() => $c() + 1, $c)
let calls = 0
const stop = observe($d, () => calls++)
assert.equal(calls, 0)
$c(2)
assert.equal(calls, 1)
stop()
