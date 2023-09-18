import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { $S } from '../index.js'
import { observe, observeNow } from './observe.js'

test('observeNow', t => {
  let $s = $S('bla')

  assert.equal($s(), 'bla')

  let value
  const setValue = v => (value = v)
  observeNow($s, setValue)
  assert.equal(value, 'bla')

  observeNow('boink', setValue)
  assert.equal(value, 'boink')
})
