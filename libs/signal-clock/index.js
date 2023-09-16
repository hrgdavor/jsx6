import { $F, observeNow, observe, signal } from '@jsx6/signal'

let clockSignal
let clockSignalSeconds
let requestAnimationFrame = globalThis.requestAnimationFrame || (f => setTimeout(() => f(), 10))

function initClockSignal() {
  clockSignal = signal(Date.now())
  clockSignalSeconds = signal(toSeconds(clockSignal()))
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
  if (typeof time === 'string') return new Date(time).getTime()
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
    if (typeof time == 'function') {
      clockSignal = $F(toMs, time)
      clockSignalSeconds = $F(toSeconds, time)
    } else {
      time = toMs(time)
      clockSignal = signal(time)
      clockSignalSeconds = signal(toSeconds(time))
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
export const $DurationSignalSeconds = (formatter, signal) => $DurationSignal(formatter, signal, 1)

/** Make a Signal that calculates duration and watches the clock to update the value along
 * with wathing the base value. Formatter will get duration in seconds.
 *
 * @param {Function} formatter convert duration in seconds to something else (usually string)
 * @param {Function} $signal base value to calculate duration from (if zero, duration is also zero)
 * @returns
 */
export function $DurationSignal(formatter, $signal, seconds = false) {
  let zeroValue = formatter(0) // use what formatter will make for zero as initial value
  let out = signal(zeroValue)
  let clock = seconds ? getClockSignalSeconds() : getClockSignal()
  // observe the signals to update the value
  observe(clock, update) // avoid triggerring update twice
  observeNow($signal, update)

  function update() {
    let signalValue = $signal()
    out(signalValue ? formatter(clock() - signalValue) : zeroValue)
  }
  return out
}
