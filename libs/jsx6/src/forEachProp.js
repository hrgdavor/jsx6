import { isObj, isArray } from './core.js'

/**
 *
 * @param {*} obj
 * @param {ForEachCallback} callback
 */
export function forEachProp(obj, callback) {
  if (obj) {
    if (isObj(obj)) {
      for (const p in obj) {
        callback(obj[p], p, obj)
      }
    } else if (isArray(obj)) {
      obj.forEach(callback)
    }
  }
}

/**
 * @callback ForEachCallback
 * @param {any} item array element
 * @param {number|string} index that is number for arrays, and string for objects
 * @param {Array} original array
 */
