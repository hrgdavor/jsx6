import { subscribeSymbol, triggerSymbol } from './observe.js'
import { prepareSignal, runFuncNoArg } from './signal.js'
import { batch } from './computed.js'

export const mergeValueSymbol = Symbol.for('signalMergeValue')
/** Marks a `$State` proxy so derived signals can recognise it as one of ours. */
export const stateSymbol = Symbol.for('signalState')

export function $State(initial) {
  let internals = {}
  let signals = {}
  let listeners = new Set()
  const getSignal = (p, initialValue) => signals[p] || getInternal(p, initialValue).$signal

  let batchLevel = 0
  const fireChanged = () => {
    if (batchLevel > 0) return
    // for (let listener of listeners) listener()
    listeners.forEach(runFuncNoArg)
  }

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
    // The alien batch makes the alien side of the graph (derived signals) coalesce into one
    // recomputation with no intermediate value; `batchLevel` keeps the original aggregate-event
    // semantics for the jsx6 listener side untouched.
    return batch(() => {
      let changed = false
      batchLevel++
      try {
        for (let p in nv) {
          if (getSignal(p)(nv[p])) changed = true
        }
      } finally {
        batchLevel--
      }
      if (!skipFire && changed) fireChanged()
      return changed
    })
  }

  function setValue(nv = {}) {
    return batch(() => {
      batchLevel++
      let changed = false
      try {
        changed = updateValue(nv, true)
        // keys that are not in the passed object 'nv' need to be reset to undefined
        // if setting so returns true, it means it was !== undefined
        for (let p in signals) {
          if (!(p in nv) && signals[p](undefined)) changed = true
        }
      } finally {
        batchLevel--
      }

      if (changed) fireChanged()
      return changed
    })
  }

  function getInternal(p, initialValue) {
    let internal = internals[p]
    if (!internal) {
      internal = internals[p] = prepareSignal(initialValue, p)
      internal.listeners.add(fireChanged)
      signals[p] = internal.$signal
    }
    return internal
  }

  let $state = function (...args) {
    if (!args.length) return getValue()
    return setValue(args[0])
  }

  let specialProps = new Map()
  // needed for observe to work
  specialProps.set(subscribeSymbol, u => {
    listeners.add(u)
    return () => listeners.delete(u)
  })
  specialProps.set(triggerSymbol, fireChanged)
  // Marks this proxy as ours, so `$S`/`$F` know they can read it inside an alien computed instead of
  // falling back to the legacy derived path.
  specialProps.set(stateSymbol, true)
  // if we try to serialize the state, user need not worry, value goes into json
  specialProps.set('toJSON', getValue)
  specialProps.set(mergeValueSymbol, updateValue)
  // `$s.count++` works because the *child* signal has its own `Symbol.toPrimitive`; on the state proxy
  // this hook exists only so coercion does something sensible. It must return a **primitive** — the
  // snapshot object made every coercion throw `TypeError: Symbol.toPrimitive returned an object`.
  // A string hint now gets the JSON snapshot; a number hint gets NaN. Same fix as `@jsx6/signal`.
  specialProps.set(Symbol.toPrimitive, hint => (hint === 'number' ? NaN : JSON.stringify(getValue())))

  let statePproxy = new Proxy($state, {
    set: function (_, prop, value) {
      getSignal(prop)(value)
      // if (getSignal(prop)(value)) fireChanged()
      return true
    },
    get: function (_, prop) {
      let spec = specialProps.get(prop)
      return spec || getSignal(prop)
    },
  })

  return statePproxy
}

export function mergeValue($state, nv = {}) {
  return $state[mergeValueSymbol]?.(nv)
}
