import { expect, test } from 'bun:test'
import { signal } from './signal.js'
import { $State } from './state.js'
import { observe, observeNow } from './observe.js'

test('signal unsubscribe', () => {
  const $s = signal(1)
  let count = 0
  const unsub = observe($s, () => {
    count = $s()
  })

  $s(2)
  expect(count).toBe(2)

  unsub()
  $s(3)
  expect(count).toBe(2)
})

test('observeNow unsubscribe', () => {
  const $s = signal(1)
  let count = 0
  const unsub = observeNow($s, () => {
    count = $s()
  })

  expect(count).toBe(1)

  $s(2)
  expect(count).toBe(2)

  unsub()
  $s(3)
  expect(count).toBe(2)
})

test('state unsubscribe', () => {
  const $s = $State({ x: 1 })
  let count = 0
  const unsub = observe($s, () => {
    count = $s().x
  })

  $s.x = 2
  expect(count).toBe(2)

  unsub()
  $s.x = 3
  expect(count).toBe(2)
})

test('state property signal unsubscribe', () => {
  const $s = $State({ x: 1 })
  let count = 0
  const unsub = observe($s.x, () => {
    count = $s.x()
  })

  $s.x = 2
  expect(count).toBe(2)

  unsub()
  $s.x = 3
  expect(count).toBe(2)
})

test('static value unsubscribe', () => {
  const val = 1
  const unsub = observe(val, () => {})
  expect(typeof unsub).toBe('undefined')
})
