import { isFunc } from './core.js'
import { mapProp } from './mapProp.js'

export function setValue(obj, value) {
  if (obj === null || obj === undefined) return obj
  if (isFunc(obj.setValue)) return obj.setValue(value)
  if (isFunc(obj)) return setValue(obj(), value)
  if (obj instanceof window.Element) {
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
