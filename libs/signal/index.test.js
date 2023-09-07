import test from 'ava'
import { $S } from './index.js'
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
  const $sum = $S((sig1, sig2) => sig1 + sig2, $sig1, $sig2)

  t.is($sig1(), 1)
  t.is($sig2(), 2)
  t.is($sum(), 3)

  $sig1(2)
  t.is($sum(), 4)
})
