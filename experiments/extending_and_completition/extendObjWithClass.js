export const extendObjWithClass = (obj, clazz) => {
  const proto = clazz.prototype
  Object.getOwnPropertyNames(proto).forEach(p => {
    if (p === 'constructor') return
    obj[p] = proto[p]
  })
}
