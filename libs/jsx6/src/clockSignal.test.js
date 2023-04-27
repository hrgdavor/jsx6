import test from 'ava'
import { makeState, setAnimFunction } from './makeState.js'
import { $DurationSignal, $DurationSignalSeconds, toSeconds, withClockTime } from './clockSignal.js'

// call immediately to update state values without async (simpler testing)
setAnimFunction(f => f())

test('duration', async t => {
  return new Promise((resolve, reject) => {
    setAnimFunction(f => setTimeout(() => f(), 10))
    let now = Date.now()
    let from = makeState(now - 73000)
    let $from2 = makeState(0)
    // this tests was made to verify tht previous impl of duration that lazy loaded clock
    // was problematic for testing, becase clock would initialize after withClockTime scope
    // and $DurationSignal would get a regular clock instead of what we passed in withClockTime
    withClockTime(now, () => {
      let $dur = $DurationSignal(toSeconds, from)
      t.is(73, $dur())
      let $durms = $DurationSignal(f => f, $from2)
      t.is(0, $durms())
      setTimeout(() => {
        $from2(now - 3)
        t.is(3, $durms())
        resolve()
      }, 30)
    })
    setAnimFunction(f => f())
  })
})
