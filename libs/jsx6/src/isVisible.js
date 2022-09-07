import { getAttrBoolean } from './getAttrBoolean.js'

export function isVisible(obj, sel) {
  return getAttrBoolean(obj, 'hidden', true)
}
