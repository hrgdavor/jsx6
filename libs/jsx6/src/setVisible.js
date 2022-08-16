import { Group } from './core'
import { setAttrBoolean } from './setAttrBoolean'
import { forEachProp } from './forEachProp'

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
