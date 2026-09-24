import { signal } from './signal.js'

export const getContext = (el, map, getValue) => {
  let out
  while (el && !(out = map.get(el))) {
    el = el.contextParent || el.parentNode
  }
  return getValue ? out : el
}

export const setContextValue = (el, v, map) => {
  map.set(el, v)
}

export function makeContext() {
  const map = new WeakMap()

  return {
    set: (el, v) => setContextValue(el, v, map),
    getContext: el => getContext(el, map),
    get: el => getContext(el, map, true),
    map,
  }
}

export const setContextSignal = (el, v, map) => {
  if (!map.has(el)) {
    map.set(el, signal(v))
  } else {
    map.get(el)(v)
  }
}

export function makeSignalContext() {
  const map = new WeakMap()

  return {
    set: (el, v) => setContextSignal(el, v, map),
    getContext: el => getContext(el, map),
    getSignal: el => getContext(el, map, true),
    get: el => getContext(el, map, true)?.(),
    map,
  }
}
