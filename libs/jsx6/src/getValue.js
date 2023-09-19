import { isFunc, isNode, isObj } from './core.js'
import { mapProp } from './mapProp.js'

export const getValueFilterSymbol = Symbol.for('getValueFilterSymbol')

export function applyGetValueFilter(value, source) {
  let filter = source[getValueFilterSymbol]
  return filter ? filter(value) : value
}

export function getValue(obj) {
  if (obj === null || obj === undefined) return obj

  let value = obj.value

  if (isFunc(obj.getValue)) {
    value = obj.getValue()
  } else if (isFunc(obj)) {
    value = getValue(obj())
  } else if (isNode(obj)) {
    if (obj.tagName === 'INPUT' && obj.type === 'checkbox') {
      value = obj.checked
    }
  } else {
    if (isObj(obj)) return mapProp(obj, getValue)
  }

  return applyGetValueFilter(value, obj)
}
