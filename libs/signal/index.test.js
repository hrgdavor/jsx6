import { test } from 'node:test'
import { strict as assert } from 'node:assert'
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

test('basics', t => {
  const $sig = $S(1)

  assert.equal($sig instanceof Function, true)

  assert.equal($sig(), 1)

  $sig(2)
  assert.equal($sig(), 2)
})

test('combine', t => {
  const $sig1 = $S(1)
  const $sig2 = $S(2)

  if (0) $sum = $sig1 + $sig2
  const $sum = $S(() => $sig1() + $sig2(), $sig1, $sig2)

  assert.equal($sig1(), 1)
  assert.equal($sig2(), 2)
  assert.equal($sum(), 3)

  $sig1(2)
  assert.equal($sum(), 4)
})

test('utils', t => {
  const $sig0 = $S(0)
  const $sig1 = $S(1)
  const $sig2 = $S(2)
  const $siga = $S('a')

  assert.equal($NOT($sig0)(), true)
  assert.equal($NOT($sig1)(), false)

  assert.equal($IS($sig0)(), false)
  assert.equal($IS($sig1)(), true)

  assert.equal($EQStrict(1, $sig1)(), true)
  assert.equal($EQStrict('1', $sig1)(), false)

  assert.equal($NEQStrict(1, $sig1)(), false)
  assert.equal($NEQStrict('1', $sig1)(), true)

  assert.equal($EQ(1, $sig1)(), true)
  assert.equal($EQ('1', $sig1)(), true)

  assert.equal($NEQ(1, $sig1)(), false)
  assert.equal($NEQ('1', $sig1)(), false)

  assert.equal($If($sig1, 'a', 'b')(), 'a')
  assert.equal($If($sig0, 'a', 'b')(), 'b')

  assert.equal($Any($sig0, $sig1, $sig2)(), true)

  assert.equal($AnyValue($sig0, $sig1, $sig2)(), 1)

  assert.equal($Or($sig0, $sig1)(), 1)
  assert.equal($Or($sig0, $sig0)(), 0)

  assert.equal($And($sig0, $sig1)(), 0)
  assert.equal($And($sig1, $sig1)(), 1)

  let map = { a: 12 }
  assert.equal($Map(map, $siga)(), 12)
})
