import { doSubscribeValue, subscribeSymbol, tryObserve } from './makeState.js'

export function combineState(bindings, callback) {
  const updaters = []

  const getValue = () => {
    const params = bindings.map(b => b())
    return callback(...params)
  }

  const listener = () => {
    const value = getValue()
    if (updaters.length) {
      updaters.forEach(u => u(value))
    }
  }

  bindings.forEach(u => tryObserve(u, listener))

  getValue[subscribeSymbol] = u => doSubscribeValue(updaters, u, getValue)

  return getValue
}