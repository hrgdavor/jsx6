import { Group } from './core.js'
import { setAttrBoolean } from './setAttrBoolean.js'
import { forEachProp } from './forEachProp.js'

export function setVisible(obj, sel) {
  if (!obj) return
  if (obj instanceof Group) {
    forEachProp(obj, (o, p) => setVisible(o, p === sel))
  } else if (obj instanceof Array) {
    obj.forEach((o, p) => setVisible(o, p === sel))
  } else {
    setAttrBoolean(obj, 'hidden', !sel)
  }
}
