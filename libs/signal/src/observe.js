export const subscribeSymbol = Symbol.for('signalSubscribe')
export const triggerSymbol = Symbol.for('signalTrigger')

/**
 * observe static value or a signal with callback being called immediately.
 * This enables simple one-shot handling of both initial value and subsequent changes.
 *
 *
 * observing static value can be useful for component parameters
 * where caller can choose to send a static value or a signal
 * but the component can with single call to observeNow support both use-cases
 *
 *
 * @param {function|any} $signal signal or static value
 * @param {function} callback called immediately and on every change. first paramter will be current value
 * @returns {boolean} if observed
 */
export const observeNow = ($signal, callback) => observe($signal, callback, true)

export function observeValue(obj, callback, trigger = false) {
  let bindingSub
  let value
  if (obj) {
    bindingSub = obj[subscribeSymbol]
    if (bindingSub) {
      if (callback) {
        bindingSub(callback)
      }
      value = obj()
    } else {
      // support for promise(.then) or observable(.subscribe) values
      bindingSub = obj.then || obj.subscribe
      if (bindingSub && callback) {
        bindingSub.call(obj, callback)
      } else {
        // not observable or Promise, it is assumed a static value
        // and will be used as alue if trigger=true
        value = obj
      }
    }
    if (trigger) callback(value)
    return value
  }
}

/**
 * observe static value or a signal with callback being called immediately.
 * This enables simple one-shot handling of both initial value and subsequent changes.
 *
 *
 * observing static value can be useful for component parameters
 * where caller can choose to send a static value or a signal
 * but the component can with single call to observeNow support both use-cases
 *
 * @param {function|any} obj signal or static value
 * @param {function} callback called on every change. first paramter will be current value
 * @param {boolean} trigger callback is also called immediately
 * @returns {boolean} if observed
 */
export function observe(obj, callback, trigger = false) {
  let bindingSub
  let value
  if (obj) {
    bindingSub = obj[subscribeSymbol]
    if (bindingSub) {
      if (callback) {
        bindingSub(callback)
      }
      value = obj()
    } else {
      // support for promise(.then) or observable(.subscribe) values
      bindingSub = obj.then || obj.subscribe
      if (bindingSub && callback) {
        bindingSub.call(obj, callback)
      } else {
        // not observable or Promise, it is assumed a static value
        // and will be used as alue if trigger=true
        value = obj
      }
    }
    if (trigger) callback(value)
    return !!bindingSub
  }
}

/**
 * manually trigger a signal
 * @param {function} $signal
 * @returns
 */
export function triggerSignal($signal) {
  const bindingTrig = $signal[triggerSymbol]
  bindingTrig?.()
  return !!bindingTrig
}

/**
 * can this obj be observed (signal or a promise)
 * @param {any} obj
 * @returns {boolean} if observable
 */
export const isObservable = obj => !!(obj[subscribeSymbol] || obj.then || obj.subscribe)
