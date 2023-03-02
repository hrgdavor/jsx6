import { isFunc } from './core.js'
import { mapProp } from './mapProp.js'

export function getValue(obj) {
  if (obj === null || obj === undefined) return obj

  if (isFunc(obj.getValue)) return obj.getValue()
  if (isFunc(obj)) return getValue(obj())

  if (obj instanceof window.Element) {
    if (obj.tagName === 'INPUT' && obj.type === 'checkbox') {
      return obj.checked
    }
  } else {
    if (isObj(obj)) return mapProp(obj, getValue)
  }

  return obj.value
}
