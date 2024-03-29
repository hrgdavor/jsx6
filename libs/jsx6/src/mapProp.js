import { isObj, isArray } from './core.js'

export const mapPropArray = (obj, callback) => mapProp(obj, callback, true)

export function mapProp(obj, callback, asArray) {
  if (obj) {
    if (isArray(obj)) {
      return obj.map(callback)
    } else if (isObj(obj)) {
      const out = asArray ? [] : {}
      if (asArray) {
        for (const p in obj) {
          out.push(callback(obj[p], p, obj))
        }
      } else {
        for (const p in obj) {
          out[p] = callback(obj[p], p, obj)
        }
      }
      return out
    }
  }
}
