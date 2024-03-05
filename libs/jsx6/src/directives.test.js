import { afterAll, beforeAll, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { h } from './jsx2dom.js'

import { signal, BOOL } from '@jsx6/signal'
import { getValue } from './getValue.js'
import { setValue } from './setValue.js'

GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

test('x-if', () => {
  let $show = signal(true)
  let div = h('DIV', { 'x-if': $show }, 'test')
  expect(div.hasAttribute('hidden')).toEqual(false)
  $show(false)
  expect(div.hasAttribute('hidden')).toEqual(true)
})

test('x-filter', () => {
  // single filter is applied to getValue
  let input = h('input', { 'x-filter': BOOL })
  // filter will generate false because '' is falsy
  expect(input.value).toEqual('')
  expect(getValue(input)).toEqual(false)

  // input works with text, so setting number will set it's value to string rep of it
  input.value = 1
  // BOOL filter will generate true because '1' is truthy
  expect(getValue(input)).toEqual(true)

  // array of filters is for getValue,setValue
  input = h('input', { 'x-filter': [null, BOOL] })

  expect(getValue(input)).toEqual('')
  setValue(input, '1')
  expect(getValue(input)).toEqual('true')
  setValue(input, '')
  expect(getValue(input)).toEqual('false')
})
//*/
