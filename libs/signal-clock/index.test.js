import { expect, test } from 'bun:test'
import { $DurationSignal, $DurationSignalSeconds, toSeconds, withClockTime } from './index.js'

import { $S, observeNow, signal } from '@jsx6/signal'

test('duration', async () => {
  return new Promise((resolve, reject) => {
    let now = Date.now()
    let from = signal(now - 73000)
    let $from2 = signal(0)
    // this tests was made to verify that previous impl of duration that lazy loaded clock
    // was problematic for testing, becase clock would initialize after withClockTime scope
    // and $DurationSignal would get a regular clock instead of what we passed in withClockTime
    withClockTime(now, () => {
      let $dur = $DurationSignal(toSeconds, from)
      expect(73).toEqual($dur())
      let $durms = $DurationSignal(f => f, $from2)
      expect(0).toEqual($durms())
      setTimeout(() => {
        $from2(now - 3)
        expect(3).toEqual($durms())
        resolve()
      }, 30)
    })
  })
})
