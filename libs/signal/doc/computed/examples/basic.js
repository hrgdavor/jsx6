/**
 * Runnable example: `$C` — lazy, memoized, auto-tracking.
 *
 * The `demo` region is what `README.md` and `doc/computed/usage.md` inject; everything outside it is
 * the check that keeps the sample honest. This file is executed by `doc/computed/examples.test.js`,
 * which the package's `bun test` runs.
 */

import assert from 'node:assert/strict'
import { $C, signal } from '../../../index.js'

// #region demo
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
// #endregion demo

assert.equal(evaluations, 2)
$b(20)
assert.equal($sum(), 30)
assert.equal(evaluations, 3)

// A cold computed is not recomputed by a write, only by a read.
$a(100)
assert.equal(evaluations, 3)
assert.equal($sum(), 120)
assert.equal(evaluations, 4)
