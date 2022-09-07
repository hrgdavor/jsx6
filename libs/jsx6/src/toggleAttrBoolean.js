import { setAttrBoolean } from './setAttrBoolean.js'
import { getAttrBoolean } from './getAttrBoolean.js'

export function toggleAttrBoolean(obj, attr, sel) {
  if (sel === undefined) sel = !getAttrBoolean(obj, attr)
  setAttrBoolean(obj, attr, sel)
  return sel
}
