import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { h } from './jsx2dom.js'

import { JSDOM } from 'jsdom'
import { signal } from '@jsx6/signal'
import { IS, NOT } from './core.js'
import { getValue } from './getValue.js'
import { setValue } from './setValue.js'

test.before(() => {
  const dom = new JSDOM('<div id="my-element-id" />') // insert any html needed for the unit test suite here
  global.document = dom.window.document // add the globals needed for the unit tests in this suite.
})

test('x-if', t => {
  let $show = signal(true)

  let div = h('DIV', { 'x-if': $show }, 'test')

  assert.equal(div.hasAttribute('hidden'), false)

  $show(false)
  assert.equal(div.hasAttribute('hidden'), true)
})

test('x-filter', t => {
  // single filter is applied to getValue
  let input = h('input', { 'x-filter': IS })
  // filter will generate false because '' is falsy
  assert.equal(input.value, '')
  assert.equal(getValue(input), false)

  // input works with text, so setting number will set it's value to string rep of it
  input.value = 1
  // NOT filter will generate true because '1' is truthy
  assert.equal(getValue(input), true)

  // array of filters is for getValue,setValue
  input = h('input', { 'x-filter': [null, IS] })

  assert.equal(getValue(input), '')
  setValue(input, '1')
  assert.equal(getValue(input), 'true')
  setValue(input, '')
  assert.equal(getValue(input), 'false')
})
