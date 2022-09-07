import { setAttrBoolean } from './setAttrBoolean.js'

export function toggleVisible(obj, sel) {
  setAttrBoolean(obj, 'hidden', !sel)
}
