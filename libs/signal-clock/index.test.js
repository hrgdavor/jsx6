import { expect, test, afterAll } from 'bun:test'
import {
  $DurationSignal,
  $DurationSignalSeconds,
  getClockSignal,
  initClockSignal,
  isClockRunning,
  stopClock,
  toMs,
  toSeconds,
  withClockTime,
} from './index.js'

import { $S, observe, observeNow, signal } from '@jsx6/signal'

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

// P2-5: `initClockSignal` used to start a `requestAnimationFrame` loop that could never be
// stopped (no handle was kept and no cancel function existed), leaking a permanent callback
// for tests, SSR and teardown. The loop is driven here by stub frame functions so the test is
// deterministic and does not depend on real animation frames.
const scheduled = []
const cancelled = []
const realRaf = globalThis.requestAnimationFrame
const realCaf = globalThis.cancelAnimationFrame
// the returned handles are opaque to the module, the test only records them
globalThis.requestAnimationFrame = callback => scheduled.push(callback)
globalThis.cancelAnimationFrame = handle => cancelled.push(handle)

afterAll(() => {
  stopClock()
  globalThis.requestAnimationFrame = realRaf
  globalThis.cancelAnimationFrame = realCaf
})

/** run the oldest scheduled frame callback */
const runNextFrame = () => scheduled.shift()()

/** run `callback` with `Date.now()` frozen at `at` */
function withFrozenNow(at, callback) {
  const realDateNow = Date.now
  Date.now = () => at
  try {
    callback()
  } finally {
    Date.now = realDateNow
  }
}

test('stopClock stops the loop and starting again works', () => {
  const clock = getClockSignal()
  expect(isClockRunning()).toBe(true)
  expect(scheduled.length).toBe(1)

  let updates = 0
  const unsubscribe = observe(clock, () => updates++)
  // the loop only publishes when the second changes, so the frame must see a later clock
  withFrozenNow(Date.now() + 5000, runNextFrame)
  expect(updates).toBe(1)
  expect(scheduled.length).toBe(1) // the running loop scheduled the next frame

  expect(stopClock()).toBe(true)
  expect(isClockRunning()).toBe(false)
  expect(cancelled.length).toBe(1) // the pending frame handle was cancelled
  expect(stopClock()).toBe(false) // stopping twice is harmless

  // a frame callback that was already queued can not be cancelled by every implementation,
  // so it must be inert: no update, no reschedule
  expect(scheduled.length).toBe(1)
  withFrozenNow(Date.now() + 5000, runNextFrame)
  expect(updates).toBe(1)
  expect(scheduled.length).toBe(0)

  // starting again works and the lazy getters return the new, live clock
  expect(initClockSignal()).toBe(true)
  expect(isClockRunning()).toBe(true)
  expect(scheduled.length).toBe(1)
  expect(initClockSignal()).toBe(false) // refuses a second loop
  expect(scheduled.length).toBe(1)

  const restarted = getClockSignal()
  expect(restarted).not.toBe(clock)
  let restartedUpdates = 0
  const unsubscribe2 = observe(restarted, () => restartedUpdates++)
  withFrozenNow(Date.now() + 5000, runNextFrame)
  expect(restartedUpdates).toBe(1)
  expect(scheduled.length).toBe(1)
  unsubscribe()
  unsubscribe2()
})

test('the fallback timer loop is cancellable too', () => {
  stopClock()
  const timers = []
  const cleared = []
  const realSetTimeout = globalThis.setTimeout
  const realClearTimeout = globalThis.clearTimeout
  globalThis.requestAnimationFrame = undefined
  globalThis.setTimeout = callback => timers.push(callback)
  globalThis.clearTimeout = handle => cleared.push(handle)
  try {
    const clock = getClockSignal()
    expect(isClockRunning()).toBe(true)
    expect(timers.length).toBe(1) // no animation frames available, a timer was scheduled

    let updates = 0
    const unsubscribe = observe(clock, () => updates++)
    expect(stopClock()).toBe(true)
    expect(isClockRunning()).toBe(false)
    expect(cleared.length).toBe(1)

    // the queued timer callback must not update or reschedule after the clock was stopped
    withFrozenNow(Date.now() + 5000, () => timers.shift()())
    expect(updates).toBe(0)
    expect(timers.length).toBe(0)
    unsubscribe()
  } finally {
    globalThis.requestAnimationFrame = handle => scheduled.push(handle)
    globalThis.setTimeout = realSetTimeout
    globalThis.clearTimeout = realClearTimeout
  }
})

// P2-5: `toMs` used to fall through as `time ? time : 0`, so any non-null object that was not a
// Date/Number was returned unchanged (a non-number leaking into arithmetic and comparisons).
test('toMs handles every accepted input shape and never returns a non-number', () => {
  const now = Date.now()
  const date = new Date(now)
  // Object(now) is a boxed Number (Number object), used by callers as a plain number
  const boxed = Object(now)

  expect(toMs(now)).toBe(now)
  expect(toMs(date)).toBe(now)
  expect(toMs(date.toISOString())).toBe(now)
  expect(toMs(boxed)).toBe(now)
  expect(toMs(0)).toBe(0)
  expect(toMs(null)).toBe(0)
  expect(toMs(undefined)).toBe(0)
  // objects that are not a Date/Number must not leak through
  expect(toMs({})).toBe(0)
  expect(toMs({ getTime: 'not a date' })).toBe(0)
  expect(toMs([])).toBe(0)
  // an unparsable string can not be interpreted as a time
  expect(toMs('not a date')).toBe(0)
  expect(typeof toMs({})).toBe('number')

  expect(toSeconds(now)).toBe(Math.floor(now / 1000))
  expect(toSeconds(date)).toBe(Math.floor(now / 1000))
  expect(toSeconds(date.toISOString())).toBe(Math.floor(now / 1000))
  expect(toSeconds(boxed)).toBe(Math.floor(now / 1000))
  expect(toSeconds(null)).toBe(0)
  expect(toSeconds({})).toBe(0)
  expect(toSeconds('not a date')).toBe(0)
})