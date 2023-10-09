import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { $DurationSignal, $DurationSignalSeconds, toSeconds, withClockTime } from './index.js'

import { $S, observeNow, signal } from '@jsx6/signal'

test('duration', async t => {
  return new Promise((resolve, reject) => {
    let now = Date.now()
    let from = signal(now - 73000)
    let $from2 = signal(0)
    // this tests was made to verify tht previous impl of duration that lazy loaded clock
    // was problematic for testing, becase clock would initialize after withClockTime scope
    // and $DurationSignal would get a regular clock instead of what we passed in withClockTime
    withClockTime(now, () => {
      let $dur = $DurationSignal(toSeconds, from)
      assert.equal(73, $dur())
      let $durms = $DurationSignal(f => f, $from2)
      assert.equal(0, $durms())
      setTimeout(() => {
        $from2(now - 3)
        console.log('now', now, $from2(), $durms())
        assert.equal(3, $durms())
        resolve()
      }, 30)
    })
  })
})