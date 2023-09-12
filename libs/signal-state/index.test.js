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
import test from 'ava'
import { $State, updateValue } from './index.js'
import { $F, $S, observe, subscribeSymbol } from '@jsx6/signal'

test('basics', t => {
  /** @type {TestState} */
  let $s = $State()

  t.deepEqual($s(), {})

  $s.x = 1
  t.is($s.x(), 1)
  t.deepEqual($s(), { x: 1 })

  $s.y = 2
  t.is($s.y(), 2)
  /**@type{TestStateValue} */
  let value = $s()
  t.deepEqual(value, { x: 1, y: 2 })

  let $sum1 = $S(() => $s.x() + $s.y(), $s.y, $s.y)
  t.is($sum1(), 3)

  let $sum2 = $S(() => $s.x() + $s.y(), $s)
  t.is($sum2(), 3)

  let $sum3 = $F(({ x, y }) => x + y, $s)
  t.is($sum3(), 3)
})

test('specials', t => {
  let $s = $State({ x: 1, y: 2 })

  t.deepEqual($s[Symbol.toPrimitive](), { x: 1, y: 2 })
  t.deepEqual($s.toJSON(), { x: 1, y: 2 })

  $s.x++
  t.deepEqual($s.toJSON(), { x: 2, y: 2 })
})

test('observe', t => {
  let $s = $State({ x: 1, y: 2 })

  let value = $s()
  t.deepEqual(value, { x: 1, y: 2 })

  // observer whole state
  observe($s, () => (value = $s()))
  $s.x++
  t.deepEqual($s.toJSON(), { x: 2, y: 2 })
  t.deepEqual(value, { x: 2, y: 2 })

  // observer specific signal
  observe($s.x, () => (value = $s()))
  $s.x++
  t.deepEqual($s.toJSON(), { x: 3, y: 2 })
  t.deepEqual(value, { x: 3, y: 2 })
})

test('setValue', t => {
  let $s = $State({ x: 1 })

  t.is($s({ y: 1 }), true)
  t.deepEqual($s(), { y: 1, x: undefined })

  // set same value again, no changes will happen, and taht is reported
  t.is($s({ y: 1 }), false)
})

test('updateValue', t => {
  let $s = $State({ x: 1 })

  t.is(updateValue($s, { y: 1 }), true)
  t.deepEqual($s(), { y: 1, x: 1 })

  // set same value again, no changes will happen, and taht is reported
  t.is(updateValue($s, { y: 1 }), false)
})
