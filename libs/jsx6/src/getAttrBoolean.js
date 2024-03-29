import { isObj } from './core.js'
import { mapProp } from './mapProp.js'

export function getAttrBoolean(obj, attr, flip) {
  if (obj) {
    if (obj.getAttribute) {
      let out = !!obj.hasAttribute(attr)
      if (flip) out = !out
      return out
    } else if (obj.el) {
      return getAttrBoolean(obj.el, attr, flip)
    } else if (obj && isObj(obj)) {
      return mapProp(obj, o => getAttrBoolean(o, attr, flip))
    }
  }
}
