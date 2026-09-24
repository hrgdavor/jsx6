import { expect, test } from 'bun:test'
import { asSignal } from './signal.js'
import { observe } from './observe.js'

test('asSignal with Promise', async () => {
  let resolve
  const promise = new Promise(r => (resolve = r))
  const $s = asSignal(promise)

  let count = 0
  observe($s, () => count++)

  resolve(10)
  await promise
  expect($s()).toBe(10)
  expect(count).toBe(1)

  // It should have cleared listeners, so further manual triggers or changes (if possible) shouldn't fire
  // However, Promise is one-shot anyway. The important thing is it works once.
})

test('asSignal with Observable (multi-shot)', () => {
  let callback
  const observable = {
    subscribe: cb => (callback = cb),
  }
  const $s = asSignal(observable)

  let count = 0
  observe($s, () => count++)

  callback(10)
  expect($s()).toBe(10)
  expect(count).toBe(1)

  callback(20)
  expect($s()).toBe(20)
  expect(count).toBe(2) // Should continue to update
})

test('asSignal with static value', () => {
  const $s = asSignal(123)
  expect($s()).toBe(123)
  expect(typeof $s.get).toBe('function')
})
