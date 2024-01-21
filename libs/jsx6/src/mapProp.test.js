import { expect, test, afterAll } from 'bun:test'
import { mapProp, mapPropArray } from './mapProp.js'

test('simple', () => {
  expect({ a: 2, b: 4 }).toEqual(mapProp({ a: 1, b: 2 }, i => i * 2))

  expect([2, 4]).toEqual(mapPropArray({ a: 1, b: 2 }, i => i * 2))

  expect([2, 4]).toEqual(mapProp([1, 2], i => i * 2))
})
