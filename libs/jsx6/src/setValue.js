import { isFunc, isNode } from './core.js'
import { mapProp } from './mapProp.js'

export const setValueFilterSymbol = Symbol.for('setValueFilterSymbol')

export function applySetValueFilter(value, source) {
  let filter = source[setValueFilterSymbol]
  return filter ? filter(value) : value
}

export function setValue(obj, value) {
  if (obj === null || obj === undefined) return

  value = applySetValueFilter(value, obj)

  if (isFunc(obj.setValue)) return obj.setValue(value)

  if (isFunc(obj)) return setValue(obj(), value)

  if (isNode(obj)) {
    if (value === undefined || value === null) value = ''
    if (obj.tagName === 'INPUT' && obj.type === 'checkbox') {
      obj.checked = value
    } else {
      obj.value = value
    }
  } else {
    value = value || {}
    mapProp(obj, (o, p) => {
      if (o) setValue(o, value[p])
    })
  }
}
