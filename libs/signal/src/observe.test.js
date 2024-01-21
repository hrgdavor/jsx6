import { expect, test } from 'bun:test'
import { $S } from '../index.js'
import { observe, observeNow } from './observe.js'

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
