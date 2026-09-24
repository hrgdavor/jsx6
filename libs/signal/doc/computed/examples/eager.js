/**
 * Runnable example: `$CE` — eager, auto-tracking.
 *
 * The counterpart of `$C`: it recomputes as soon as a dependency changes, whether or not anybody reads
 * it, which is the behaviour `$S`/`$F` have always had.
 */

import assert from 'node:assert/strict'
import { $CE, signal } from '../../../index.js'

// #region demo
const $a = signal(1)

let evaluations = 0
const $doubled = $CE(() => {
  evaluations++
  return $a() * 2
})

// Eager: the first evaluation happens at creation, not at the first read.
assert.equal(evaluations, 1)

$a(5)
// Still nobody has read it, and it is already up to date.
assert.equal(evaluations, 2)
assert.equal($doubled(), 10)
assert.equal(evaluations, 2)
// #endregion demo

$a(6)
assert.equal(evaluations, 3)

// `$S(fn, deps)` is the same eager behaviour with an explicit dependency list.
const $s = signal(1)
let sRuns = 0
const $derived = $CE(() => {
  sRuns++
  return $s() + 1
})
assert.equal(sRuns, 1)
$s(2)
assert.equal(sRuns, 2)
assert.equal($derived(), 3)
