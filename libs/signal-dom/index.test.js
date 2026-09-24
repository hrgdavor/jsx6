import { expect, test } from 'bun:test'
import { runInBatch } from './index.js'

// regression test: runDirty used to call an undefined `runFunc` (missing helper),
// so every queued batch threw a ReferenceError and no callback was ever executed
test('runInBatch runs the queued callback', () => {
  let calls = 0
  runInBatch(() => calls++)
  expect(calls).toBe(1)
})

test('a throwing callback does not stop the rest of the batch', () => {
  let calls = 0
  const error = console.error

  console.error = () => {}
  try {
    runInBatch([
      () => {
        throw new Error('boom')
      },
      () => calls++,
    ])
  } finally {
    console.error = error
  }
  expect(calls).toBe(1)
})
