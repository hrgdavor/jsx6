import { isFunc } from './core.js'
import { mapProp } from './mapProp.js'

export const outputFilterSymbol = Symbol.for('outputValueFilter')

export function applyOutputFilter(value, source) {
  let filter = source[outputFilterSymbol]
  return filter ? filter(value) : value
}

export function setValue(obj, value) {
  if (obj === null || obj === undefined) return

  value = applyOutputFilter(value, obj)

  if (isFunc(obj.setValue)) return obj.setValue(value)

  if (isFunc(obj)) return setValue(obj(), value)

  if (obj instanceof window.Element) {
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
