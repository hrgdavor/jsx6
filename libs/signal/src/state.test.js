// sample typedoc one might want to use to define state for better autocomplete
/**
 *
 * @typedef {Object} TestStateValue
 * @prop {number} x
 * @prop {number} y
 *
 * @typedef {Object} TestState
 * @prop {function(number):number} x
 * @prop {function(number):number} y
 */
import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { $State, mergeValue } from './state.js'
import { $F, $S } from '../index.js'
import { observe } from './observe.js'

test('basics', t => {
  /** @type {TestState} */
  let $s = $State()

  assert.deepEqual($s(), {})

  $s.x = 1
  assert.equal($s.x(), 1)
  assert.deepEqual($s(), { x: 1 })

  $s.y = 2
  assert.equal($s.y(), 2)
  /**@type{TestStateValue} */
  let value = $s()
  assert.deepEqual(value, { x: 1, y: 2 })

  let $sum1 = $S(() => $s.x() + $s.y(), $s.y, $s.y)
  assert.equal($sum1(), 3)

  let $sum2 = $S(() => $s.x() + $s.y(), $s)
  assert.equal($sum2(), 3)

  let $sum3 = $F(({ x, y }) => x + y, $s)
  assert.equal($sum3(), 3)
})

test('specials', t => {
  let $s = $State({ x: 1, y: 2 })

  assert.deepEqual($s[Symbol.toPrimitive](), { x: 1, y: 2 })
  assert.deepEqual($s.toJSON(), { x: 1, y: 2 })

  $s.x++
  assert.deepEqual($s.toJSON(), { x: 2, y: 2 })
})

test('observe', t => {
  let $s = $State({ x: 1, y: 2 })

  let value = $s()
  assert.deepEqual(value, { x: 1, y: 2 })

  // observer whole state
  observe($s, () => (value = $s()))
  $s.x++
  assert.deepEqual($s.toJSON(), { x: 2, y: 2 })
  assert.deepEqual(value, { x: 2, y: 2 })

  // observer specific signal
  observe($s.x, () => (value = $s()))
  $s.x++
  assert.deepEqual($s.toJSON(), { x: 3, y: 2 })
  assert.deepEqual(value, { x: 3, y: 2 })
})

test('setValue', t => {
  let $s = $State({ x: 1 })

  assert.equal($s({ y: 1 }), true)
  assert.deepEqual($s(), { y: 1, x: undefined })

  // set same value again, no changes will happen, and taht is reported
  assert.equal($s({ y: 1 }), false)
})

test('mergeValue', t => {
  let $s = $State({ x: 1 })

  assert.equal(mergeValue($s, { y: 1 }), true)
  assert.deepEqual($s(), { y: 1, x: 1 })

  // set same value again, no changes will happen, and taht is reported
  assert.equal(mergeValue($s, { y: 1 }), false)
})
