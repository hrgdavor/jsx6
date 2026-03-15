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
 * @param {function} callback called immediately and on every change. value is passed ONLY when triggered immediately. Subsequent calls have NO arguments.
 * @returns {function|undefined} unsubscribe function if observed
 */
export const observeNow = ($signal, callback) => observe($signal, callback, true)

/**
 * observe static value or a signal.
 * Callback is NOT called on first subscribe unless trigger=true.
 * Wrapper for callback IS added for signals so that value is passed to callback.
 *
 * @param {function|any} $signal signal or static value
 * @param {function} callback called on every change. 
 * @param {boolean} trigger callback is also called immediately
 * @returns {function|undefined} unsubscribe function if observed
 */
export const observe = ($signal, callback, trigger = false) => _observe($signal, callback, trigger, true)

/**
 * observe static value or a signal.
 * Callback is NOT called on first subscribe unless trigger=true.
 * Wrapper for callback is NOT added for signals. 
 * observing static value will NOT result in callback being called if trigger=true.
 *
 * @param {function|any} $signal signal or static value
 * @param {function} callback called on every change. 
 * @param {boolean} trigger callback is also called immediately
 * @returns {function|undefined} unsubscribe function if observed
 */
export const subscribe = ($signal, callback, trigger = false) => _observe($signal, callback, trigger, false)

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
 * @param {function} callback called on every change. value is passed ONLY when triggered immediately. Subsequent calls have NO arguments.
 * @param {boolean} trigger callback is also called immediately
 * @returns {function|undefined} unsubscribe function if observed
 */
/**
 * internal observe base
 *
 * @param {function|any} obj signal or static value
 * @param {function} callback called on every change. value is passed ONLY when triggered immediately. Subsequent calls have NO arguments.
 * @param {boolean} trigger callback is also called immediately
 * @param {boolean} passValue make sure signals to pass current value (false does not guarantee value will not be passed)
 * @returns {function|undefined} unsubscribe function if observed
 */
function _observe(obj, callback, trigger = false, passValue = false) {
  let bindingSub
  let value
  let unsubscribe
  if (obj) {
    bindingSub = obj[subscribeSymbol]
    if (bindingSub) {
      if (callback) {
        const wrapped = passValue ? () => callback(obj()) : () => callback()
        unsubscribe = bindingSub(wrapped)
      }
      if (passValue) value = obj()
    } else {
      // support for promise(.then) or observable(.subscribe) values
      bindingSub = obj.then || obj.subscribe
      if (bindingSub && callback) {
        const wrapped = passValue ? callback : () => callback()
        bindingSub.call(obj, wrapped)
      } else {
        // not observable or Promise, it is assumed a static value
        // and will be used as value if trigger=true
        if (passValue) value = obj
      }
    }
  }
  if (trigger) callback(value)
  return unsubscribe
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
export const isObservable = obj => !!(obj && (obj[subscribeSymbol] || typeof obj.then === 'function' || typeof obj.subscribe === 'function'))
