import { JSX6E16_CUSTOM_ELEMENT_DEFINED, JSX6E7_REQUIRE_FUNC } from './errorCodes.js'

export const TRANS = {}

export class Group {
  constructor(obj) {
    for (let p in obj) this[p] = obj[p]
  }
}

export function addTranslations(trans) {
  Object.assign(TRANS, trans)
}

export function t(code, ...rest) {
  // when used with template literals we need to re-generate the full string
  if (code instanceof Array) {
    if (rest.length) {
      const tmp = [code[0]]
      for (let i = 1; i < code.length; i++) {
        tmp.push(rest[i - 1])
        tmp.push(code[i])
      }
      code = tmp
    }
    code = code.join('')
  }

  return TRANS[code] || code
}

export const errorMessage = c => t(errCode(c))

export const throwErr = (c, ...info) => {
  const code = errCode(c)
  let msg = t(code)
  if (msg != code) msg = code + ' ' + msg
  console.error(msg, ...info)
  throw new Error(msg)
}

export const isFunc = f => typeof f === 'function'
export const isStr = s => typeof s === 'string'
export const isObj = o => typeof o === 'object'
export const isObjNN = o => o !== null && typeof o === 'object'
export const isNullish = o => o !== null && o === undefined
export const isArray = a => a instanceof Array

/** Check if a value is a DOM Node. You may be tempted to use 'instanceof Node'
 *  but that is not reliable if checking an element from a different frame/iframe
 *
 * @param {any} obj
 * @returns {Boolean} true/false if passed value is a Node or not
 */
export const isNode = obj => obj?.nodeType !== undefined //

/** Check if a value is a DOM TextNode.
 *
 * @param {any} obj
 * @returns {Boolean} true/false if passed value is a TextNode or not
 */
export const isTextNode = obj => obj?.nodeType === 3 //

/** Check if value is a Function, return the function so function call can be chained
 * or throw an error if value is not a function
 *
 * @param {any} func
 * @param {Number} err error code
 * @returns {Function} provided function
 * @throws Error if value is not a function
 */
export const requireFunc = (func, err = JSX6E7_REQUIRE_FUNC) => {
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

/** Call a function and catch any errors. Errors are printed using console.error.
 *
 * @param {Function} f the function to call
 * @param {Array} args arguments for the function
 */
export const runFuncNoArg = f => {
  try {
    f()
  } catch (e) {
    console.error(e, f)
  }
}

/** Generate error code for JSX6 errors.
 *
 * @param {Number} c numeric code of the error
 * @returns {String} code: 'JSX6E' + c
 */
const errCode = c => 'JSX6E' + c
