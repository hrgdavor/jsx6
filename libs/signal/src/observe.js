export const subscribeSymbol = Symbol.for('signalSubscribe')
export const triggerSymbol = Symbol.for('signalTrigger')

export const observeNow = ($signal, callback) => observe($signal, callback, true)

export function observe(obj, callback = null, trigger) {
  if (!obj) return false
  const bindingSub = obj[subscribeSymbol]
  if (bindingSub) {
    if (callback) {
      bindingSub(callback)
      if (trigger) callback(obj())
    }
    return true
  }
  // support for promise(.then) or observable(.subscribe) values
  const toObserve = obj.then || obj.subscribe
  if (toObserve) {
    if (callback) {
      toObserve.call(obj, callback)
      if (trigger) callback(undefined)
    }
    return true
  }
}

export function triggerSignal($signal) {
  const bindingTrig = $signal[triggerSymbol]
  bindingTrig?.()
  return !!bindingTrig
}

export const isObservable = obj => observe(obj)
