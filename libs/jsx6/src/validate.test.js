import { expect, test, afterAll } from 'bun:test'
import { genRequired, isAllValid, requiredRule, validate } from './validate.js'
import { forEachProp } from './forEachProp.js'

// for complex tests, checking if reference to rule is returned is cumbersome
function noRule(v) {
  if (!v) return
  if (v.rule) delete v.rule
  if (v.items) {
    forEachProp(v.items, noRule)
  }
  return v
}

function delayed(v) {
  return new Promise(resolve => {
    setTimeout(() => resolve(v))
  })
}

test('required', async () => {
  let rule = {
    items: {
      name: requiredRule(),
    },
  }
  let nameReq = genRequired('name', rule.items.name)
  expect(await validate({}, rule)).toEqual({ field: '', items: { name: nameReq } })

  expect(noRule(await validate({}, rule))).toEqual({ field: '', items: { name: genRequired('name') } })
})

test('array required at least one', async () => {
  let result
  let rule = {
    items: {
      names: { items: [requiredRule()] },
    },
  }
  // not required, and no elements in array, means it is valid
  result = await validate({}, rule)
  expect(result).toEqual({ field: '', items: { names: { field: 'names', items: [] } } })
  expect(isAllValid(result)).toBeTrue()

  rule = {
    items: {
      names: { required: true, items: [requiredRule()] },
    },
  }
  let nameReq = { ...genRequired('names', rule.items.names), items: [] }
  // required, and no elements in array, means it is not valid
  result = await validate({}, rule)
  expect(result).toEqual({
    field: '',
    items: {
      names: nameReq,
    },
  })
  expect(isAllValid(result)).toBeFalse()

  expect(noRule(result)).toEqual({
    field: '',
    items: { names: { field: 'names', message: 'required', type: 'required', items: [] } },
  })
})

test('array required array element simple value', async () => {
  let result
  let rule = {
    items: {
      names: { items: [requiredRule()] },
    },
  }
  let nameReq = genRequired(0, rule.items.names.items[0])
  result = await validate({ names: [''] }, rule)
  expect(result).toEqual({ field: '', items: { names: { field: 'names', items: [nameReq] } } })
  expect(isAllValid(result)).toBeFalse()

  result = await validate({ names: ['bla', 'bla'] }, rule)
  expect(result).toEqual({ field: '', items: { names: { field: 'names', items: [undefined, undefined] } } })
  expect(isAllValid(result)).toBeTrue()

  result = await validate({ names: ['', 'bla'] }, rule)
  // frist item will be err for empty string, and second undefined for valid string 'bla'
  expect(result).toEqual({ field: '', items: { names: { field: 'names', items: [nameReq, undefined] } } })
  expect(isAllValid(result)).toBeFalse()
})

test('only array required array element object', async () => {
  let result
  let nameRule = requiredRule()
  let rule = {
    items: {
      names: { items: [{ items: { name: nameRule } }] },
    },
  }
  let nameReq = { field: 0, items: { name: genRequired('name', nameRule) } }
  result = await validate({ names: [{}] }, rule)
  expect(result).toEqual({ field: '', items: { names: { field: 'names', items: [nameReq] } } })
  expect(isAllValid(result)).toBeFalse()

  result = await validate({ names: [{ name: 'bla' }, { name: 'bla' }] }, rule)
  let nameOk = field => ({ field, items: { name: undefined } })
  expect(result).toEqual({ field: '', items: { names: { field: 'names', items: [nameOk(0), nameOk(1)] } } })
  expect(isAllValid(result)).toBeTrue()

  result = await validate({ names: [{ name: '' }, { name: 'bla' }] }, rule)
  // // frist item will be err for empty string, and second undefined for valid string 'bla'
  expect(result).toEqual({ field: '', items: { names: { field: 'names', items: [nameReq, nameOk(1)] } } })
  expect(isAllValid(result)).toBeFalse()
})

test('async', async () => {
  let rule = {
    items: {
      name: { validate: delayed },
    },
  }
  expect(await validate({}, rule)).toEqual({ field: '', items: { name: undefined } })
})
