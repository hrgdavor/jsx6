import { prepareSignal, subscribeSymbol, triggerSymbol } from '@jsx6/signal'

export const updateValueSymbol = Symbol.for('signalUpdateValue')

export function $State(initial) {
  let internals = {}
  let signals = {}
  const getSignal = (p, initialValue) => signals[p] || getInternal(p, initialValue).$signal

  for (let p in initial) {
    getSignal(p, initial[p])
  }

  function getValue() {
    let out = {}
    for (let p in internals) {
      out[p] = signals[p]()
    }
    return out
  }

  function updateValue(nv = {}, skipFire) {
    let changed = false
    for (let p in nv) {
      if (getSignal(p)(nv[p])) changed = true
    }
    if (!skipFire) fireChanged()
    return changed
  }

  function setValue(nv = {}) {
    let changed = updateValue(nv, true)
    // keys that are not in the passed object 'nv' need to be reset to undefined
    // if setting so returns true, it means it was !== undefined
    for (let p in signals) {
      if (!(p in nv) && signals[p](undefined)) changed = true
    }

    if (changed) fireChanged()
    return changed
  }

  function getInternal(p, initialValue) {
    let internal = internals[p]
    if (!internal) {
      internal = internals[p] = prepareSignal(initialValue)
      signals[p] = internal.$signal
    }
    return internal
  }

  let listeners = new Set()
  const fireChanged = () => {
    for (let listener of listeners) listener()
  }

  let $state = function (...args) {
    if (!args.length) return getValue()
    return setValue(args[0])
  }

  let specialProps = new Map()
  // needed for observe to work
  specialProps.set(subscribeSymbol, u => listeners.add(u))
  specialProps.set(triggerSymbol, fireChanged)
  // if we try to serialize the state, user need not worry, value goes into json
  specialProps.set('toJSON', getValue)
  specialProps.set(updateValueSymbol, updateValue)
  // allows for tricks like $s.count++
  specialProps.set(Symbol.toPrimitive, getValue)

  let statePproxy = new Proxy($state, {
    set: function (_, prop, value) {
      if (getSignal(prop)(value)) fireChanged()
      return true
    },
    get: function (_, prop) {
      let spec = specialProps.get(prop)
      return spec || getSignal(prop)
    },
  })

  return statePproxy
}

export function updateValue($state, nv = {}) {
  return $state[updateValueSymbol]?.(nv)
}
