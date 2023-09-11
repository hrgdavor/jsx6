import test from 'ava'
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

  t.is($sig instanceof Function, true)

  t.is($sig(), 1)

  $sig(2)
  t.is($sig(), 2)
})

test('combine', t => {
  const $sig1 = $S(1)
  const $sig2 = $S(2)

  if (0) $sum = $sig1 + $sig2
  const $sum = $S(() => $sig1() + $sig2(), $sig1, $sig2)

  t.is($sig1(), 1)
  t.is($sig2(), 2)
  t.is($sum(), 3)

  $sig1(2)
  t.is($sum(), 4)
})

test('utils', t => {
  const $sig0 = $S(0)
  const $sig1 = $S(1)
  const $sig2 = $S(2)
  const $siga = $S('a')

  t.is($NOT($sig0)(), true)
  t.is($NOT($sig1)(), false)

  t.is($IS($sig0)(), false)
  t.is($IS($sig1)(), true)

  t.is($EQStrict(1, $sig1)(), true)
  t.is($EQStrict('1', $sig1)(), false)

  t.is($NEQStrict(1, $sig1)(), false)
  t.is($NEQStrict('1', $sig1)(), true)

  t.is($EQ(1, $sig1)(), true)
  t.is($EQ('1', $sig1)(), true)

  t.is($NEQ(1, $sig1)(), false)
  t.is($NEQ('1', $sig1)(), false)

  t.is($If($sig1, 'a', 'b')(), 'a')
  t.is($If($sig0, 'a', 'b')(), 'b')

  t.is($Any($sig0, $sig1, $sig2)(), true)

  t.is($AnyValue($sig0, $sig1, $sig2)(), 1)

  t.is($Or($sig0, $sig1)(), 1)
  t.is($Or($sig0, $sig0)(), 0)

  t.is($And($sig0, $sig1)(), 0)
  t.is($And($sig1, $sig1)(), 1)

  let map = { a: 12 }
  t.is($Map(map, $siga)(), 12)
})
