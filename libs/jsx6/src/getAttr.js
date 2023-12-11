import { isObj } from './core.js'
import { mapProp } from './mapProp.js'

export function getAttr(obj, attr, def = null) {
  if (obj) {
    if (obj.getAttribute) {
      let out = obj.getAttribute(attr)
      return out === null ? def : out
    } else if (obj.el) {
      return getAttr(obj.el, attr, def)
    } else if (obj && isObj(obj)) {
      return mapProp(obj, o => getAttr(o, attr, def))
    }
  }
}
