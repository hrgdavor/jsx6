import { expect, test } from 'bun:test'
import { $S } from '../index.js'
import { observe, observeNow, subscribe } from './observe.js'

test('observeNow', () => {
  let $s = $S('bla')

  expect($s()).toEqual('bla')

  let value
  const setValue = v => (value = v)
  observeNow($s, setValue)
  expect(value).toEqual('bla')

  observeNow('boink', setValue)
  expect(value).toEqual('boink')
})

test('subscribe', () => {
  let $s = $S('bla')

  let value = 'init'
  let callCount = 0
  const callback = v => {
    value = v
    callCount++
  }

  // subscribe without trigger
  const unsub1 = subscribe($s, callback)
  expect(callCount).toEqual(0)
  expect(value).toEqual('init')

  $s('new')
  expect(callCount).toEqual(1)
  expect(value).toBeUndefined() // subscribe does not pass value

  unsub1()

  // subscribe with trigger
  callCount = 0
  value = 'init'
  subscribe($s, callback, true)
  expect(callCount).toEqual(1)
  expect(value).toBeUndefined() // trigger respects passValue=false

  $s('next')
  expect(callCount).toEqual(2)
  expect(value).toBeUndefined() // subsequent triggers don't pass value
})

test('subscribe with Promise', async () => {
  let value = 'init'
  const p = Promise.resolve('finished')
  subscribe(p, v => (value = v))
  await p
  expect(value).toBeUndefined() // subscribe masks value from Promise
})

test('subscribe with Observable', () => {
  let value = 'init'
  const obs = {
    subscribe: cb => {
      cb('val1')
      cb('val2')
    },
  }
  subscribe(obs, v => (value = v))
  expect(value).toBeUndefined() // subscribe masks value from Observable
})
