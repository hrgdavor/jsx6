import { isNode, isObj } from './core.js'

export function setAttrBoolean(obj, attr, value) {
  if (obj) {
    if (obj.setAttribute) {
      if (value) {
        if (!obj.hasAttribute(attr)) obj.setAttribute(attr, attr)
      } else {
        if (obj.hasAttribute(attr)) obj.removeAttribute(attr)
      }
    } else if (isNode(obj.el)) {
      setAttrBoolean(obj.el, attr, value)
    } else if (isObj(obj)) {
      for (const p in obj) {
        setAttrBoolean(obj[p], attr, p === value)
      }
    }
  }
}
