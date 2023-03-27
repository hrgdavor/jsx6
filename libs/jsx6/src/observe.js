import { isFunc, throwErr } from './core.js'
import { ERR_NOT_OBSERVABLE } from './errorCodes.js'

export const subscribeSymbol = Symbol('subscribe')

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

  getValue[subscribeSymbol] = u => doSubscribeValue(updaters, u, getValue)

  return getValue
}

export function observe(obj, callback) {
  if (!tryObserve(obj, callback)) throwErr(ERR_NOT_OBSERVABLE, obj)
}

export function tryObserve(obj, callback) {
  const bindingSub = obj[subscribeSymbol]
  if (bindingSub) {
    if (callback) bindingSub(callback)
    return true
  }
  // support for promise(.then) or observable(.subscribe) values
  const toObserve = obj.then || obj.subscribe
  if (toObserve) {
    if (callback) toObserve.call(obj, callback)
    return true
  }
}

export const isObservable = obj => tryObserve(obj)
