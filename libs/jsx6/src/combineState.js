import { doSubscribeValue } from './makeState.js'
import { subscribeSymbol, tryObserve } from './observe.js'

export const $S = (callback, ...bindings) => {
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

export const $R = $S

export const $NOT = signal => $S(v => !v, signal)
export const $BOOL = signal => $S(v => !!v, signal)
export const $EQ = (to, signal) => $S(v => to === v, signal)
export const $NEQ = (to, signal) => $S(v => to !== v, signal)
