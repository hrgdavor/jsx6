/**
 * Runnable example: `batch()` — several writes, one settled value, no intermediate value observed.
 */

import assert from 'node:assert/strict'
import { $S, $State, batch, observe } from '../../../index.js'

// #region demo
const $s = $State({ x: 1, y: 1 })
const $sum = $S(() => $s.x() + $s.y(), $s)

const seen = []
observe($sum, () => seen.push($sum()))

// Two writes outside a batch: the observer sees the intermediate value.
$s.x = 2
$s.y = 3

batch(() => {
  $s.x = 10
  $s.y = 20
})
// #endregion demo

// One notification per write outside the batch, one for the whole batch.
assert.deepEqual(seen, [3, 5, 30])

// The batch hides the intermediate value: only the settled 30 was observed.
assert.equal($sum(), 30)

// A batch is exception safe: a throw closes it and later writes still propagate.
assert.throws(() =>
  batch(() => {
    $s.x = 1
    throw new Error('boom')
  }),
)
$s.y = 1
assert.equal($sum(), 2)
