/**
 * Runnable example: where dependencies come from.
 *
 * Three cases that look alike but behave differently:
 *   1. a read of one of our signals is tracked automatically;
 *   2. a read the collector cannot see needs an explicit dependency;
 *   3. a declared dependency that the callback never reads still invalidates.
 */

import assert from 'node:assert/strict'
import { $C, $S, signal, subscribeSymbol } from '../../../index.js'

// #region tracked
const $a = signal(1)
const $b = signal(2)

// No dependency list: both reads are tracked.
const $sum = $C(() => $a() + $b())
assert.equal($sum(), 3)

$b(20)
assert.equal($sum(), 21)
// #endregion tracked

// #region union
// An explicit list is still honoured, and it is a *union* with what the callback reads: the omitted
// `$b` is tracked anyway, so a forgotten dependency is no longer a silent bug.
// eslint-disable-next-line jsx6/signal-dependencies -- omitting $b is the point of this sample
const $unionSum = $S(() => $a() + $b(), $a)
assert.equal($unionSum(), 21)

$b(30)
assert.equal($unionSum(), 31)
// #endregion union

// #region duck-typed
// A duck-typed signal (the shape `@jsx6/jsx6` uses for translations) has no getter of ours, so its
// read cannot be seen. The declared list is the only way to learn that it changed.
let shipping = 'standard'
const listeners = new Set()
const $shipping = () => shipping
$shipping[subscribeSymbol] = cb => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

const $label = $S(() => `shipping: ${$shipping()}`, $shipping)
assert.equal($label(), 'shipping: standard')

shipping = 'express'
listeners.forEach(cb => cb())
assert.equal($label(), 'shipping: express')
// #endregion duck-typed

// #region declared-unread
// A declared dependency the callback never reads still invalidates — the 1.8 behaviour, preserved.
const $flag = signal(1)
let runs = 0
const $ignoresFlag = $S(() => {
  runs++
  return 'constant'
}, $flag)

assert.equal($ignoresFlag(), 'constant')
const before = runs
$flag(2)
assert.ok(runs > before) // it recomputed...
assert.equal($ignoresFlag(), 'constant') // ...and published the same value
// #endregion declared-unread
