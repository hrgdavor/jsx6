import { expect, test } from 'bun:test'
import {
  $And,
  $Any,
  $AnyValue,
  $EQ,
  $EQStrict,
  $IS,
  $If,
  $Map,
  $NEQ,
  $NEQStrict,
  $NOT,
  $Or,
  $S,
} from './index.js'
// call immediately to update state values without async (simpler testing)

test('basics', () => {
  const $sig = $S(1)

  expect($sig instanceof Function).toEqual(true)

  expect($sig()).toEqual(1)

  $sig(2)
  expect($sig()).toEqual(2)
})

test('combine', () => {
  const $sig1 = $S(1)
  const $sig2 = $S(2)

  //if (0) $sum = $sig1 + $sig2
  const $sum = $S(() => $sig1() + $sig2(), $sig1, $sig2)

  expect($sig1()).toEqual(1)
  expect($sig2()).toEqual(2)
  expect($sum()).toEqual(3)

  $sig1(2)
  expect($sum()).toEqual(4)
})

test('utils', () => {
  const $sig0 = $S(0)
  const $sig1 = $S(1)
  const $sig2 = $S(2)
  const $siga = $S('a')

  expect($NOT($sig0)()).toEqual(true)
  expect($NOT($sig1)()).toEqual(false)

  expect($IS($sig0)()).toEqual(false)
  expect($IS($sig1)()).toEqual(true)

  expect($EQStrict(1, $sig1)()).toEqual(true)
  expect($EQStrict('1', $sig1)()).toEqual(false)

  expect($NEQStrict(1, $sig1)()).toEqual(false)
  expect($NEQStrict('1', $sig1)()).toEqual(true)

  expect($EQ(1, $sig1)()).toEqual(true)
  expect($EQ('1', $sig1)()).toEqual(true)

  expect($NEQ(1, $sig1)()).toEqual(false)
  expect($NEQ('1', $sig1)()).toEqual(false)

  expect($If($sig1, 'a', 'b')()).toEqual('a')
  expect($If($sig0, 'a', 'b')()).toEqual('b')

  expect($Any($sig0, $sig1, $sig2)()).toEqual(true)

  expect($AnyValue($sig0, $sig1, $sig2)()).toEqual(1)

  expect($Or($sig0, $sig1)()).toEqual(1)
  expect($Or($sig0, $sig0)()).toEqual(0)

  expect($And($sig0, $sig1)()).toEqual(0)
  expect($And($sig1, $sig1)()).toEqual(1)

  let map = { a: 12 }
  expect($Map(map, $siga)()).toEqual(12)
})
