import { mapProp } from './mapProp.js'
import { Group } from './core.js'
import { setAttrBoolean } from './setAttrBoolean.js'

export function setSelected(obj, sel) {
  if (!obj) return
  if (obj instanceof Group) {
    mapProp(obj, (o, p) => setSelected(o, p === sel))
  } else {
    setAttrBoolean(obj, 'selected', sel)
  }
}
