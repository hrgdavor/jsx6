import { $F, observeNow, observe, signal } from '@jsx6/signal'

/**
 * A clock signal created with `@jsx6/signal`: calling it without arguments reads the value,
 * calling it with a value sets it (the setter result is not used in this module).
 *
 * @template T
 * @typedef {(value?: T) => T} ClockSignal
 */

/**
 * `@jsx6/signal` does not describe the call shape of the signals it creates (`$F` is typed
 * as plain `Function`), so this gives them the ClockSignal shape used in this module.
 *
 * @template T
 * @param {Function} $signal
 * @returns {ClockSignal<T>}
 */
const asClockSignal = $signal => /** @type {any} */ ($signal)

/** @type {ClockSignal<number>} */
let clockSignal
/** @type {ClockSignal<any>} */
let clockSignalDate
/** @type {ClockSignal<number>} */
let clockSignalSeconds
/**
 * cancel function of the currently scheduled clock tick (`requestAnimationFrame` or timer)
 *
 * @type {(() => void) | undefined}
 */
let cancelFrame
/** true while the clock loop is scheduling ticks */
let clockRunning = false
/** incremented on every start/stop so a tick that could not be cancelled cannot revive the loop */
let clockGeneration = 0

/**
 * Schedule the next clock tick.
 *
 * `requestAnimationFrame` is looked up per tick and called through its global: a detached
 * reference (`const raf = window.requestAnimationFrame; raf(cb)`) throws `Illegal invocation`
 * in real browsers. When there is no animation frame API (tests, SSR, workers) a timer is used
 * instead, and both variants return the matching cancel function so the loop stays stoppable.
 *
 * @param {() => void} callback
 * @returns {() => void} cancels the scheduled tick
 */
function scheduleClockTick(callback) {
  const raf = globalThis.requestAnimationFrame
  if (typeof raf === 'function') {
    const handle = raf.call(globalThis, callback)
    return () => globalThis.cancelAnimationFrame(handle)
  }
  const handle = setTimeout(callback, 10)
  return () => clearTimeout(handle)
}

/**
 * Start the clock loop; the clock signals are (re)created here.
 *
 * Calling this while the loop is already running is a no-op: a second animation-frame loop
 * would leak an extra permanent callback and update the signals twice. After {@link stopClock}
 * the clock can be started again.
 *
 * @returns {boolean} true when this call started the loop, false when it was already running
 */
export function initClockSignal() {
  if (clockRunning) return false
  clockGeneration++
  clockSignal = asClockSignal(signal(Date.now()))
  clockSignalDate = asClockSignal(signal(new Date()))
  clockSignalSeconds = asClockSignal(signal(toSeconds(clockSignal())))
  clockRunning = true
  cancelFrame = undefined
  callNext(clockGeneration)
  return true
}

/**
 * Stop the loop started by {@link initClockSignal}: the pending tick is cancelled, a callback
 * that was already queued can no longer reschedule or update anything, and the clock signals
 * are released so the lazy getters start a fresh clock on their next use. Being able to stop
 * the loop matters for tests, SSR and teardown, where a permanent animation-frame callback
 * would keep updating values of a page that no longer exists.
 *
 * @returns {boolean} true when a running loop was stopped
 */
export function stopClock() {
  if (!clockRunning) return false
  clockRunning = false
  // invalidate ticks that are already queued and can no longer be cancelled
  clockGeneration++
  if (cancelFrame) {
    cancelFrame()
    cancelFrame = undefined
  }
  // release the clock signals, the next getClockSignal*() call recreates and restarts them
  clockSignal = /** @type {any} */ (undefined)
  clockSignalDate = /** @type {any} */ (undefined)
  clockSignalSeconds = /** @type {any} */ (undefined)
  return true
}

/** @returns {boolean} true while the clock loop is scheduling clock ticks */
export function isClockRunning() {
  return clockRunning
}

/**
 * @param {number} generation generation the tick was scheduled for
 */
function callNext(generation) {
  // a stale tick belongs to a stopped/restarted loop: it must not update or reschedule
  if (!clockRunning || generation !== clockGeneration) return
  let now = Date.now()
  let nows = toSeconds(now)
  if (nows !== clockSignalSeconds()) {
    clockSignal(now)
    clockSignalDate(now)
    clockSignalSeconds(nows)
  }
  cancelFrame = scheduleClockTick(() => callNext(generation))
}

/**
 * Convert a time value to milliseconds since the epoch.
 *
 * Accepted shapes: `Date`, ISO/parsable date string, number, boxed `Number`, and nullish
 * values. The return value is always a `number`: anything that cannot be interpreted as a
 * time (including an unparsable string) becomes `0`, so no caller can receive a non-number
 * by accident. A boxed `Number` is unwrapped to its primitive value.
 *
 * @param {number|string|Date|Number|null|undefined} time
 * @returns {number} timestamp in miliseconds
 */
export function toMs(time) {
  if (typeof time === 'number') return time
  if (typeof time === 'string') {
    const ms = new Date(time).getTime()
    return Number.isNaN(ms) ? 0 : ms
  }
  // a boxed Number is unwrapped to its primitive value
  if (time instanceof Number) return time.valueOf()
  if (time instanceof Date) return time.getTime()
  // nullish values and anything else that is not a time (plain object, boolean, bigint, symbol)
  return 0
}

/**
 *
 * @param {number|string|Date|Number|null|undefined} time
 * @returns {number} timestamp in seconds
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
  let cd = clockSignalDate
  let cs = clockSignalSeconds
  try {
    if (typeof time == 'function') {
      clockSignal = asClockSignal($F(toMs, time))
      clockSignalDate = asClockSignal($F(x => x, time))
      clockSignalSeconds = asClockSignal($F(toSeconds, time))
    } else {
      clockSignalDate = asClockSignal(signal(time))
      time = toMs(time)
      clockSignal = asClockSignal(signal(time))
      clockSignalSeconds = asClockSignal(signal(toSeconds(time)))
    }
    callback()
  } finally {
    clockSignal = c
    clockSignalDate = cd
    clockSignalSeconds = cs
  }
}

/**
 * @returns {ClockSignal<number>} current clock signal in miliseconds
 */
export function getClockSignal() {
  if (!clockSignal) initClockSignal()
  return clockSignal
}

/**
 * @returns {ClockSignal<any>} current clock signal with Date object
 */
export function getClockSignalDate() {
  if (!clockSignal) initClockSignal()
  return clockSignalDate
}

/**
 * @returns {ClockSignal<number>} current clock signal in seconds
 */
export function getClockSignalSeconds() {
  if (!clockSignal) initClockSignal()
  return clockSignalSeconds
}

/** Make a Signal that calculates duration and watches the clock to update the value along
 * with wathing the base value. Formatter will get duration in seconds.
 *
 * @param {Function} formatter convert duration in seconds to something else (usually string)
 * @param {Function} signal base value to calculate duration from (if zero, duration is also zero)
 * @returns {ClockSignal<any>} signal with the duration
 */
export const $DurationSignalSeconds = (formatter, signal) => $DurationSignal(formatter, signal, true)

/** Make a Signal that calculates duration and watches the clock to update the value along
 * with wathing the base value. Formatter will get duration in miliseconds.
 *
 * @param {Function} formatter convert duration in miliseconds to something else (usually string)
 * @param {Function} $signal base value to calculate duration from (if zero, duration is also zero)
 * @param {boolean} [seconds] true to use the clock signal with seconds instead of miliseconds
 * @returns {ClockSignal<any>} signal with the duration
 */
export function $DurationSignal(formatter, $signal, seconds = false) {
  let zeroValue = formatter(0) // use what formatter will make for zero as initial value
  /** @type {ClockSignal<any>} */
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
