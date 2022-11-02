import test from 'ava'
import { makeState, setAnimFunction } from './makeState.js'
import { tryObserve } from './observe.js'
import { $R } from './combineState.js'

// call immediately to update state values without async (simpler testing)
setAnimFunction(f => f())

test('combine', t => {
  const $num = makeState(5)
  const $state = makeState({ count: 4 })

  let testVar = 0

  const combo = $R((num, count) => num + count + 100, $num, $state.count)
  const half = $R(num => num / 2, $num)
  tryObserve(combo, v => {
    testVar = v
  })

  // 5 + 4 + 100
  t.is(combo(), 109)
  t.is(testVar, 109)

  $num(1) // 1 + 4 + 100
  t.is(combo(), 105)
  t.is(testVar, 105)

  $state.count++ // 1 + 5 + 100
  t.is(combo(), 106)
  t.is(testVar, 106)
})
