import { isFunc, throwErr } from './core.js'
import { doSubscribeValue } from './makeState.js'
import { ERR_NOT_OBSERVABLE } from './errorCodes.js'

export const subscribeSymbol = Symbol('subscribe')
export const triggerSymbol = Symbol('trigger')

export function mapObserver(obj, mapper) {
  // if (obj.isBindingFunc) return obj(mapper)

  const listener = v => {
    let value = mapper(v)
    if (updaters.length) {
      updaters.forEach(u => u(value))
    }
  }

  tryObserve(obj, listener)

  const getValue = () => {
    return value
  }
  const updaters = []
  const value = mapper(isFunc(obj) ? obj() : undefined)

  getValue[subscribeSymbol] = (u, skipTrigger) => doSubscribeValue(updaters, u, getValue, skipTrigger)

  return getValue
}

export function observe(obj, callback) {
  if (!tryObserve(obj, callback)) throwErr(ERR_NOT_OBSERVABLE, obj)
}

export function tryObserve(obj, callback = null, skipTrigger) {
  if (!obj) return false
  const bindingSub = obj[subscribeSymbol]
  if (bindingSub) {
    if (callback) bindingSub(callback, skipTrigger)
    return true
  }
  // support for promise(.then) or observable(.subscribe) values
  const toObserve = obj.then || obj.subscribe
  if (toObserve) {
    if (callback) toObserve.call(obj, callback)
    return true
  }
}

export function tryTriggerSignal($signal) {
  const bindingTrig = $signal[triggerSymbol]
  bindingTrig?.()
  return !!bindingTrig
}

export const isObservable = obj => tryObserve(obj)
