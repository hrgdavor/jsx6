import { backend } from './runtime.js'

const map = new WeakMap()

export function listenUntil(ref, el, name, cb, options) {
  return addFinalizer(ref, backend.current.listen(el, name, cb, options))
}

export function listenCustomUntil(ref, el, name, cb, options) {
  return addFinalizer(ref, backend.current.listenCustom(el, name, cb, options))
}

export function addFinalizer(ref, fn) {
  let arr = map.get(ref)
  if (!arr) map.set(ref, (arr = []))
  arr.push(fn)
  return fn
}

export function finalize(ref) {
  map.get(ref)?.forEach(backend.current.runFuncNoArg)
  map.delete(ref)
  if (backend.current.isNode(ref?.el)) finalize(ref.el)
}
