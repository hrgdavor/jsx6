/**
 * @typedef ValidationRule
 * @prop {undefined|boolean|string} [required] - truthy means required, shoud be string
 * @prop {string} [message] - message when fails, if not specified, type is returned in validation result
 * @prop {number} [min]
 * @prop {number} [max]
 * @prop {string} [type]
 * @prop {string} [example]
 * @prop {Object.<string,ValidationRule>|Array.<ValidationRule>} [items] - if has subdocument
 * @prop {string|RegExp} [pattern]
 * @prop {function} [validate]
 *
 * @typedef ValidationResult
 * @prop {string} message - message if failed
 * @prop {string} [type]
 * @prop {string} field
 * @prop {ValidationRule} rule - original rule that caused this validation error
 * @prop {Object.<string,ValidationRule>|Array.<ValidationResult>} items - if has subdocument
 */

/**
 *
 * @param {any} v
 * @param {ValidationRule} rule
 * @param {string} field
 * @returns
 */
export async function validate(v, rule = {}, field = '') {
  const { validate: _validate, items } = rule

  // rule uses a custom validation function
  if (_validate) return await _validate(v, rule, field)

  // simple validation is called for leaf values
  let result = validateSimple(v, rule, field)
  //console.trace('field', field, result)
  if (items) {
    if (!result) result = { field }
    let out
    if (items instanceof Array) {
      // array items declare validation rule as single element of array
      out = []
      if (v)
        for (let p = 0; p < v.length; p++) {
          out[p] = await validate(v?.[p], items[0], p)
        }
    } else {
      // object items declare validation rule string:ValidationRule
      out = {}
      for (let p in items) {
        out[p] = await validate(v?.[p], items[p], p)
      }
    }
    result.items = out
  }

  return result
  // no return means undefined, means valid
}

export const genRequired = (field, rule) => {
  const required = rule ? rule.required : 'required'
  return {
    field,
    rule,
    message: typeof required === 'string' ? required : 'required',
    type: 'required',
  }
}

/** Sync validation of only synchronous rules from ValidationRule.
 * It ignores `validate` function in the rule, as that function could be async.
 * if `validate` function is present you should
 *
 * @param {any} v
 * @param {ValidationRule} rule
 * @param {string} field
 * @returns
 */
function validateSimple(v, rule = {}, field) {
  const { required, message = 'invalid_value', type = 'pattern', min, max, example, pattern } = rule
  //console.log('field', field, v)
  if (v === null || v === undefined || v === '' || (required && v && v instanceof Array && !v.length)) {
    return required ? genRequired(field, rule) : undefined // undefined means valid
  }

  if (!pattern) return // undefined means valid

  var reg = pattern instanceof RegExp ? pattern : new RegExp(pattern)
  if (!reg.test(v)) {
    return { ...rule, value: v, field }
  }

  var hasMin = min !== void 0 && min !== null
  var hasMax = max !== void 0 && max !== null
  if (hasMin || hasMax) {
    v = parseFloat(v)
    var prep = { type: 'invalid_range', value: v, min, max, field }
    if (hasMax && hasMin) {
      if (v < min || v > max) prep.message = 'must_be_between'
    } else if (hasMax) {
      if (v > max) prep.message = 'max_allowed_value'
    } else if (hasMin) {
      if (v < min) prep.message = 'min_allowed_value'
    }
    if (prep.message) return prep
  }
}

/**
 *
 * @param {ValidationResult} result
 * @returns
 */
export function isAllValid(result) {
  if (!result) return true
  const { items, message } = result
  if (message) return false
  if (items instanceof Array) {
    for (let i = 0; i < items.length; i++) {
      if (!isAllValid(items[i])) return false
    }
  } else {
    for (let i in items) {
      if (!isAllValid(items[i])) return false
    }
  }
  return true
}

export const requiredRule = (message = 'required') => ({ required: message })

export const intRule = (required, min, max) => ({
  required,
  min,
  max,
  pattern: '^-*\\d+$',
  example: '123',
  message: 'must_be_integer',
})

export const floatRule = (required, min, max) => ({
  required,
  min,
  max,
  pattern: '^-*((\\d+)|(\\d+\\.\\d+))$',
  example: '11.45',
  message: 'must_be_decimal',
})
