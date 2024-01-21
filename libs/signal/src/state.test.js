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
import { expect, test } from 'bun:test'
import { $State, mergeValue } from './state.js'
import { $F, $S } from '../index.js'
import { observe } from './observe.js'

test('basics', () => {
  /** @type {TestState} */
  let $s = $State()

  expect($s()).toEqual({})

  $s.x = 1
  expect($s.x()).toEqual(1)
  expect($s()).toEqual({ x: 1 })

  $s.y = 2
  expect($s.y()).toEqual(2)
  /**@type{TestStateValue} */
  let value = $s()
  expect(value).toEqual({ x: 1, y: 2 })

  let $sum1 = $S(() => $s.x() + $s.y(), $s.y, $s.y)
  expect($sum1()).toEqual(3)
  expect($sum1()).toEqual(3)

  let $sum2 = $S(() => $s.x() + $s.y(), $s)
  expect($sum2()).toEqual(3)

  let $sum3 = $F(({ x, y }) => x + y, $s)
  expect($sum3()).toEqual(3)
})

test('specials', () => {
  let $s = $State({ x: 1, y: 2 })

  expect($s[Symbol.toPrimitive]()).toEqual({ x: 1, y: 2 })
  expect($s.toJSON()).toEqual({ x: 1, y: 2 })

  $s.x++
  expect($s.toJSON()).toEqual({ x: 2, y: 2 })
})

test('observe', () => {
  let $s = $State({ x: 1, y: 2 })

  let value = $s()
  expect(value).toEqual({ x: 1, y: 2 })

  // observer whole state
  observe($s, () => (value = $s()))
  $s.x++
  expect($s.toJSON()).toEqual({ x: 2, y: 2 })
  expect(value).toEqual({ x: 2, y: 2 })

  // observer specific signal
  observe($s.x, () => (value = $s()))
  $s.x++
  expect($s.toJSON()).toEqual({ x: 3, y: 2 })
  expect(value).toEqual({ x: 3, y: 2 })
})

test('setValue', () => {
  let $s = $State({ x: 1 })

  expect($s({ y: 1 })).toEqual(true)
  expect($s()).toEqual({ y: 1, x: undefined })

  // set same value again, no changes will happen, and taht is reported
  expect($s({ y: 1 })).toEqual(false)
})

test('mergeValue', () => {
  let $s = $State({ x: 1 })

  expect(mergeValue($s, { y: 1 })).toEqual(true)
  expect($s()).toEqual({ y: 1, x: 1 })

  // set same value again, no changes will happen, and taht is reported
  expect(mergeValue($s, { y: 1 })).toEqual(false)
})
//*/
