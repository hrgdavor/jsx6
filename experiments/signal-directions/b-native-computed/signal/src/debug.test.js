import { expect, test } from 'bun:test'
import { signal } from './signal.js'

test('signal labels', () => {
  const $s = signal(1, 'mySignal')
  expect($s.label).toBe('mySignal')
  expect($s.name).toBe('mySignal')
})

test('signal without labels', () => {
  const $s = signal(1)
  expect($s.label).toBeUndefined()
  expect($s.name).toBe('$signal') // Default function name
})
