const TRANS = {}

export class Group {}

export function addTranslations(trans) {
  Object.assign(TRANS, trans)
}

export function t(code) {
  return TRANS[code] || code
}

export const errorMessage = c => t(errCode(c))

export const throwErr = (c, info) => {
  const code = errCode(c)
  let msg = t(code)
  if (msg != code) msg = code + ' ' + msg
  console.error(msg, info)
  throw new Error(msg)
}

export const NOT = v => !v
export const BOOL = v => !!v

export const isFunc = f => typeof f === 'function'
export const isStr = s => typeof s === 'string'
export const isObj = o => typeof o === 'object'
export const isObjNN = o => o !== null && typeof o === 'object'
export const isArray = a => a instanceof Array

/** Check if a value is a DOM Node. You may be tempted to use 'instanceof Node'
 *  but that is not reliable if checking an element from a different frame/iframe
 *
 * @param {any} obj
 * @returns {Boolean} true/false if passed value is a Node or not
 */
export const isNode = obj => obj?.nodeType !== undefined //

/** Check if value is a Function, return the function so function call can be chained
 * or throw an error if value is not a function
 *
 * @param {any} func
 * @param {Number} err error code
 * @returns {Function} provided function
 * @throws Error if value is not a function
 */
export const requireFunc = (func, err = ERR_REQUIRE_FUNC) => {
  if (!func || !isFunc(func)) {
    throwErr(err, { func })
  }
  return func
}

/** Call a function and catch any errors. Errors are printed using console.error.
 *
 * @param {Function} f the function to call
 * @param {Array} args arguments for the function
 */
export const runFunc = (f, args = []) => {
  try {
    f(...args)
  } catch (e) {
    console.error(e, f, args)
  }
}

/** Generate error code for JSX6 errors.
 *
 * @param {Number} c numeric code of the error
 * @returns {String} code: 'JSX6E' + c
 */
const errCode = c => 'JSX6E' + c
