import test from 'ava'
import { makeState, setAnimFunction } from './makeState.js'
import { tryObserve } from './observe.js'
import { $S } from './combineState.js'

// call immediately to update state values without async (simpler testing)
setAnimFunction(f => f())

test('combine', t => {
  const $num = makeState(5)
  const $state = makeState({ count: 4 })

  let testVar = 0

  const combo = $S((num, count) => num + count + 100, $num, $state.count)
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

  $state.count++ // 1 + 5 + 100
  t.is(combo(), 106)
  t.is(testVar, 106)
})

export const $NOT = signal => $S(v => !v, signal)
export const $BOOL = signal => $S(v => !!v, signal)
export const $EQ = (to, signal) => $S(v => to === v, signal)
export const $NEQ = (to, signal) => $S(v => to !== v, signal)
