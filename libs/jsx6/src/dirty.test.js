import test from 'ava'
import { makeState, setAnimFunction } from './dirty.js'

// call immediately to update state values without async (simpler testing)
setAnimFunction(f => f())

test('ONLY state basics', t => {
  const state = makeState()
  const div2 = x => x / 2

  t.is(state instanceof Function, true)

  state.count = 1

  t.is(state.count(), 1)

  state.count += 1
  t.is(state.count(), 2)
  // state.count(div2) return updatable function, so we need to call it to get actual value
  // state.count(div2) is for templates <b>{state.count(div2)}</div>
  t.is(state.count(div2)(), 1)

  t.pass()
})
