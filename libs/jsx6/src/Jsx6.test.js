import { afterAll, expect, test } from 'bun:test'

import { GlobalRegistrator } from '@happy-dom/global-registrator'

import { Jsx6 } from './Jsx6.js'

GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

// P0-2: Jsx6#mergeValue called an unimported `mergeValue`, so every call threw a ReferenceError.
test('mergeValue merges into the value state', () => {
  const comp = new Jsx6()
  comp.setValue({ a: 1, b: 2 })

  comp.mergeValue({ b: 3, c: 4 })

  expect(comp.getValue()).toEqual({ a: 1, b: 3, c: 4 })
})

test('mergeValue is a no-op for equal values but reports nothing to consumers', () => {
  const comp = new Jsx6()
  comp.setValue({ a: 1 })

  expect(() => comp.mergeValue({ a: 1 })).not.toThrow()
  expect(comp.getValue()).toEqual({ a: 1 })
})

test('setValue and getValue round-trip through the value state', () => {
  const comp = new Jsx6()
  comp.setValue({ x: 1 })
  expect(comp.getValue()).toEqual({ x: 1 })

  comp.setValue({ x: 2 })
  expect(comp.getValue()).toEqual({ x: 2 })
})