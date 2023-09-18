import { isFunc, isObj } from './core.js'
import { mapProp } from './mapProp.js'

export const inputFilterSymbol = Symbol.for('inputValueFilter')

export function applyInputFilter(value, source) {
  let filter = source[inputFilterSymbol]
  return filter ? filter(value) : value
}

export function getValue(obj) {
  if (obj === null || obj === undefined) return obj

  let value = obj.value

  if (isFunc(obj.getValue)) {
    value = obj.getValue()
  } else if (isFunc(obj)) {
    value = getValue(obj())
  } else if (obj instanceof window.Element) {
    if (obj.tagName === 'INPUT' && obj.type === 'checkbox') {
      value = obj.checked
    }
  } else {
    if (isObj(obj)) return mapProp(obj, getValue)
  }

  return applyInputFilter(value)
}
