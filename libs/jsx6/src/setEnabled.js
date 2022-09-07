import { mapProp } from './mapProp.js'
import { Group } from './core.js'
import { setAttrBoolean } from './setAttrBoolean.js'

export function setEnabled(obj, sel) {
  if (!obj) return
  if (obj instanceof Group) {
    mapProp(obj, (o, p) => setEnabled(o, p === sel))
  } else {
    setAttrBoolean(obj, 'disabled', !sel)
  }
}
