import { isFunc, isNode, listen, listenCustom, runFuncNoArg } from '@jsx6/jsx6'

const map = new WeakMap()

export function listenUntil(ref, el, name, cb, options) {
  return addFinalizer(ref, listen(el, name, cb, options))
}

export function listenCustomUntil(ref, el, name, cb, options) {
  return addFinalizer(ref, listenCustom(el, name, cb, options))
}

export function addFinalizer(ref, fn) {
  let arr = map.get(ref)
  if (!arr) map.set(ref, (arr = []))
  arr.push(fn)
  return fn
}

export function finalize(ref) {
  map.get(ref)?.forEach(runFuncNoArg)
  map.delete(ref)
  if (isNode(ref?.el)) finalize(ref.el)
}
