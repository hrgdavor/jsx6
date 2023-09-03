import { subscribeSymbol, triggerSymbol } from './observe'

export const ValueSymbol = Symbol.for('signalValue')

export function signal(value) {
  return prepareSignal(value).$signal
}

export function prepareSignal(value) {
  const listeners = []

  const $signal = (...args) => {
    // getter
    if (args.length === 0) return value

    // setter
    const [v] = args
    if (v === value) return
    value = v
    fireChanged()
  }

  Object.defineProperty($signal, ValueSymbol, { get: $signal }) // allows getting velue in Chrome dev tools

  const fireChanged = () => {
    if (listeners.length) {
      listeners.forEach(u => u(value))
    }
  }

  $signal[subscribeSymbol] = u => listeners.push(u)
  $signal[triggerSymbol] = fireChanged

  return { $signal, fireChanged, listeners }
}
