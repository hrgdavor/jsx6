
/**
 * @typedef ValidationRule
 * @prop {booelan|string} required - truthy means required, shoud be string  
 * @prop {string} message - message when fails 
 * @prop {number} min 
 * @prop {number} max 
 * @prop {string} type
 * @prop {string} example 
 * @prop {Object.<string,ValidationRule>} items - if has subdocument 
 * @prop {string|RegExp|function} pattern 
 * 
 * @typedef ValidationResult
 * @prop {string} message - message if failed 
 * @prop {string} type
 * @prop {string} field
 * @prop {ValidationRule} rule
 * @prop {Object.<string,ValidationRule>} items - if has subdocument 
*/

/**
 * 
 * @param {any} v 
 * @param {ValidationRule} rule 
 * @returns 
*/
export function validate(v, rule, field) {
  const { required, message = 'invalid_value', type = 'pattern', min, max, example, pattern, items } = rule
  // if(field == 'name2') debugger
  if(items){
    let out = {}
    for(let p in items){
      out[p] = validate(v?.[p], items[p], p)
    }
    return {items:out, field}
  }

  if (typeof pattern == 'function') {
    return pattern(v, rule)
  }

  if(v && v instanceof Array){
    return {items: v.map(checkOne), field}
  }else{
    return checkOne(v, field)
  }

  function checkOne(v2, field){
    if (v2 === null || v2 === void 0 || v2 === '' || v2 === false || (v2 && v2 instanceof Array && !v2.length)) {
      return required ? { type: 'required', message: typeof required === 'string' ? required: 'required', rule, field } : undefined
    }
  
    if (!pattern) return // undefined means valid

    var reg = pattern instanceof RegExp ? pattern : new RegExp(pattern)
    if (!reg.test(v2)) {
      return { type, message, value, example, min, max, rule, field }
    }
  
    var hasMin = min !== void 0 && min !== null
    var hasMax = max !== void 0 && max !== null
    if (hasMin || hasMax) {
      v2 = parseFloat(v2)
      var prep = { type: 'invalid_range', min, max, field }
      if (hasMax && hasMin) {
        if (v2 < min || v2 > max) prep.message = 'must_be_between'
      } else if (hasMax) {
        if (v2 > max) prep.message = 'max_allowed_value'
      } else if (hasMin) {
        if (v2 < min) prep.message = 'min_allowed_value'
      }
      if (prep.message) return prep
    }
  }
  // no return means undefined, means valid
}

export function isAllValid(result){
  if(!result) return true
  const {items,message} = result
  if(message) return false
  if(items instanceof Array){
    for(let i=0; i<items.length; i++){
      if(!isAllValid(items[i])) return false
    }
  }else{
    for(let i in items){
      if(!isAllValid(items[i])) return false
    }
  }
  return true
}

export const requiredRule = (message='required') => ({required:message})

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

