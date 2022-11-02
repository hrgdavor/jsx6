import test from 'ava'
import { makeState, setAnimFunction } from './makeState.js'
import { $R } from './combineState.js'
import { tryObserve } from './observe.js'

// call immediately to update state values without async (simpler testing)
setAnimFunction(f => f())

test('basics', t => {
  const $state = makeState({})

  t.is($state instanceof Function, true)

  $state.count = 1
  t.is($state.count(), 1)

  $state.count += 1
  t.is($state.count(), 2)

  t.deepEqual($state(), { count: 2 })
})

test('state filter', t => {
  const div2 = x => x / 2

  const $state = makeState({ count: 2 })

  // state.count(div2) returns binding function, so we need to call .get it to get actual value
  // state.count(div2) is for templates <b>{state.count(div2)}</div> because there it is recognized
  // as binding and then is observed for changes which are then applied to DOM
  t.is($R(div2, $state.count)(), 1)
})

test('primitives', t => {
  t.is(makeState(1)(), 1)
  t.is(makeState('asd')(), 'asd')
  t.is(makeState(undefined)(), undefined)
  t.is(makeState(null)(), null)
})

test('subscribe', t => {
  const $num = makeState(1)
  let testVar = 0

  let obeserved = tryObserve($num, v => (testVar = v))
  t.is(obeserved, true)

  t.is(testVar, 1) // we started with zero, so callback from observing is required
  t.is($num(), 1)

  $num(5)
  t.is(testVar, 5)
  t.is($num(), 5)
})

test('value mapping', t => {
  const $state = makeState({ count: 2 })
  const div2 = v => v / 2

  t.is($state.count(), 2)
  t.is($state().count, 2)

  t.is($R(div2, $state.count)(), 1)
})
