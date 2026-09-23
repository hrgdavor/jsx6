import { expect, test } from 'bun:test'

import { Group, isArray, isFunc, isNode, isNullish, isObj, isObjNN, isStr, isTextNode, t, throwErr } from './core.js'

// P2-5: `isNullish` was `o !== null && o === undefined`, i.e. it never matched `null`.
test('isNullish matches both null and undefined', () => {
  expect(isNullish(null)).toBe(true)
  expect(isNullish(undefined)).toBe(true)
  expect(isNullish(0)).toBe(false)
  expect(isNullish('')).toBe(false)
  expect(isNullish(false)).toBe(false)
  expect(isNullish({})).toBe(false)
})

test('type guards', () => {
  expect(isFunc(() => {})).toBe(true)
  expect(isFunc('x')).toBe(false)
  expect(isStr('x')).toBe(true)
  expect(isObj({})).toBe(true)
  expect(isObjNN(null)).toBe(false)
  expect(isArray([])).toBe(true)
  expect(isNode({ nodeType: 1 })).toBe(true)
  expect(isNode({})).toBe(false)
  expect(isTextNode({ nodeType: 3 })).toBe(true)
  expect(isTextNode({ nodeType: 1 })).toBe(false)
})

test('throwErr reports the error code and payload', () => {
  const errors = []
  const realError = console.error
  console.error = (...args) => errors.push(args.map(a => String(a)).join(' '))
  try {
    expect(() => throwErr(8, { parent: undefined })).toThrow('JSX6E8')
  } finally {
    console.error = realError
  }
  expect(errors.length).toBe(1)
  expect(errors[0]).toContain('JSX6E8')
})

test('Group copies own properties and t passthrough maps unknown codes', () => {
  const g = new Group({ a: 1, b: 2 })
  expect(g.a).toBe(1)
  expect(g.b).toBe(2)
  expect(t('JSX6E8')).toBe('JSX6E8')
})