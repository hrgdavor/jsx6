import { subscribeSymbol, triggerSymbol } from './observe.js'

export const ValueSymbol = Symbol.for('signalValue')

export function signal(value) {
  return prepareSignal(value).$signal
}

export function prepareSignal(value) {
  const listeners = new Set()

  function setValue(v) {
    if (v === value) return
    value = v
    return true
  }

  const $signal = (...args) => {
    // getter
    if (args.length === 0) return value

    // setter
    if (setValue(args[0])) {
      fireChanged()
      return true
    }
  }

  Object.defineProperty($signal, ValueSymbol, { get: $signal }) // allows getting velue in Chrome dev tools

  const fireChanged = () => {
    for (let listener of listeners) listener(value)
  }

  $signal[subscribeSymbol] = u => listeners.add(u)
  $signal[triggerSymbol] = fireChanged
  $signal[Symbol.toPrimitive] = () => value

  return { $signal, fireChanged, listeners, setValue }
}
