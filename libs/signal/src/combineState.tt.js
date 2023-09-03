import test from 'ava'
import { makeState, setAnimFunction } from './makeState.js'
import { tryObserve } from './observe.js'
import { $EQ, $EQStrict, $IS, $NEQ, $NEQStrict, $NOT, $S } from './combineState.js'

// call immediately to update state values without async (simpler testing)
setAnimFunction(f => f())

test('combine', t => {
  const $num = makeState(5)
  const $s = makeState({ count: 4 })
  {
  }
  let testVar = 0

  const combo = $S((num, count) => num + count + 100, $num, $s.count)
  const half = $S(num => num / 2, $num)
  tryObserve(combo, v => {
    testVar = v
  })

  // 5 + 4 + 100
  t.is(combo(), 109)
  t.is(testVar, 109)

  $num(1) // 1 + 4 + 100
  t.is(combo(), 105)
  t.is(testVar, 105)

  $s.count++ // 1 + 5 + 100
  t.is(combo(), 106)
  t.is(testVar, 106)
})

test('NOT and IS', t => {
  const $s = makeState({ count: 4 })

  const $signalIS = $IS($s.count)
  const $signalNOT = $NOT($s.count)

  let valueNOT
  tryObserve($signalNOT, v => (valueNOT = v))
  t.is(valueNOT, false)
  t.is($signalNOT(), false)
  t.is($signalIS(), true)
  ;[
    [0, false],
    [null, false],
    [undefined, false],
    ['', false],
    [1, true],
    ['1', true],
  ].forEach(pair => {
    let [inp, out] = pair
    let info = JSON.stringify(pair)
    $s.count = inp
    t.is(valueNOT, !out, `value ${info}`)
    t.is($signalNOT(), !out, `signal $NOT ${info}`)
    t.is($signalIS(), out, `signal $BOOL ${info}`)
  })
})

test('EQ and NEQ', t => {
  const $s = makeState({ count: 4 })

  const $signalEQ = $EQ(4, $s.count)
  const $signalNEQ = $NEQ(4, $s.count)

  let valueEQ
  tryObserve($signalEQ, v => (valueEQ = v))
  t.is(valueEQ, true)
  t.is($signalEQ(), true)
  t.is($signalNEQ(), false)
  ;[
    [0, false],
    [null, false],
    [undefined, false],
    ['', false],
    [1, false],
    ['4', true], // difference between EQ vs EQStrict
    [4, true],
  ].forEach(pair => {
    let [inp, out] = pair
    let info = JSON.stringify(pair)
    $s.count = inp
    t.is(valueEQ, out, `value ${info}`)
    t.is($signalEQ(), out, `signal $EQ ${info}`)
    t.is($signalNEQ(), !out, `signal $NEQ ${info}`)
  })
})

test('EQS and NEQS', t => {
  const $s = makeState({ count: 4 })

  const $signalEQS = $EQStrict(4, $s.count)
  const $signalNEQS = $NEQStrict(4, $s.count)

  let valueEQ
  tryObserve($signalEQS, v => (valueEQ = v))
  t.is(valueEQ, true)
  t.is($signalEQS(), true)
  t.is($signalNEQS(), false)
  ;[
    [0, false],
    [null, false],
    [undefined, false],
    ['', false],
    [1, false],
    ['4', false], // difference between EQ vs EQStrict
    [4, true],
  ].forEach(pair => {
    let [inp, out] = pair
    let info = JSON.stringify(pair)
    $s.count = inp
    t.is(valueEQ, out, `value ${info}`)
    t.is($signalEQS(), out, `signal $EQStrict ${info}`)
    t.is($signalNEQS(), !out, `signal $NEQStrict ${info}`)
  })
})

test('TS', t => {
  const $s = makeState('1')

  let $signal = $S`(${$s})`

  t.is($signal(), '(1)')
  $s(2)
  t.is($signal(), '(2)')
  $s('aasd')
  t.is($signal(), '(aasd)')

  $signal = $S`(${$s}/${2})`
  t.is($signal(), '(aasd/2)')
})
