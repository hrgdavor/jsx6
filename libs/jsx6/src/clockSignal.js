import { $S } from './combineState.js'
import { makeState } from './makeState.js'
import { tryObserve } from './observe.js'
import { isFunc, isStr } from './core.js'

let clockSignal
let clockSignalSeconds

function initClockSignal() {
  clockSignal = makeState(Date.now())
  clockSignalSeconds = makeState(toSeconds(clockSignal()))
  function callNext() {
    let now = Date.now()
    let nows = toSeconds(now)
    if (nows !== clockSignalSeconds()) {
      clockSignal(now)
      clockSignalSeconds(nows)
    }
    requestAnimationFrame(callNext)
  }
  callNext()
}

/**
 *
 * @param {number|string|Date} time
 * @returns timestamp in miliseconds
 */
export function toMs(time) {
  if (time instanceof Number) return time
  if (time instanceof Date) return time.getTime()
  if (isStr(time)) return new Date(time).getTime()
  return time ? time : 0
}

/**
 *
 * @param {number|string|Date} time
 * @returns timestamp in seconds
 */
export function toSeconds(time) {
  return Math.floor(toMs(time) / 1000)
}

/** run code with a replacement clock signal.
 *
 * @param {number|string|Date|Function} time value or a substiture clock signal
 * @param {*} callback
 */
export function withClockTime(time, callback) {
  let c = clockSignal
  let cs = clockSignalSeconds
  try {
    if (isFunc(time)) {
      clockSignal = $S(toMs, time)
      clockSignalSeconds = $S(toSeconds, time)
    } else {
      time = toMs(time)
      clockSignal = makeState(time)
      clockSignalSeconds = makeState(toSeconds(time))
    }
    callback()
  } finally {
    clockSignal = c
    clockSignalSeconds = cs
  }
}

/**
 * @returns current clock signal in miliseconds
 */
export function getClockSignal() {
  if (!clockSignal) initClockSignal()
  return clockSignal
}

/**
 * @returns current clock signal in seconds
 */
export function getClockSignalSeconds() {
  if (!clockSignal) initClockSignal()
  return clockSignalSeconds
}

/** Make a Signal that calculates duration and watches the clock to update the value along
 * with wathing the base value. Formatter will get duration in miliseconds.
 *
 * @param {Function} formatter convert duration in miliseconds to something else (usually string)
 * @param {Function} signal base value to calculate duration from (if zero, duration is also zero)
 * @returns
 */
export const $DurationSignalSeconds = (formatter, signal) => makeDurationSignal(formatter, signal, 1)

/** Make a Signal that calculates duration and watches the clock to update the value along
 * with wathing the base value. Formatter will get duration in seconds.
 *
 * @param {Function} formatter convert duration in seconds to something else (usually string)
 * @param {Function} signal base value to calculate duration from (if zero, duration is also zero)
 * @returns
 */
export function $DurationSignal(formatter, signal, seconds = false) {
  let zeroValue = formatter(0) // use what formatter will make for zero as initial value
  let out = makeState(zeroValue)
  let clock
  // observe the signal to update the value
  tryObserve(signal, update) // this will also trigger update function with initial value

  // if the current value for signal is zero or null, clock will not be initialized
  // when a value arrives we will initialize the clock and listen to the clock signal

  function update() {
    let signalValue = signal()
    let val = zeroValue
    if (signalValue) {
      // we have a value, so we can proceed with calculating duration and formatting it
      if (!clock) {
        // lazy initialize the clock
        clock = seconds ? getClockSignalSeconds() : getClockSignal()
        tryObserve(clock, update)
        return // tryObserve will trigger udpate immediately, so we do not need to continue to the calculation
      }
      val = formatter(clock() - signalValue)
    }
    out(val)
  }
  return out
}
