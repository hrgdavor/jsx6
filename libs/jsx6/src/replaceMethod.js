export function reaplaceMethod(obj, methodName, newMethod) {
  let old = obj[methodName]
  obj[methodName] = newMethod
  return old
}
