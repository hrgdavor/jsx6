import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { h } from './jsx2dom.js'

import { $State, $F } from '@jsx6/signal'

import { JSDOM } from 'jsdom'

test.before(() => {
  const dom = new JSDOM('<div id="my-element-id" />') // insert any html needed for the unit test suite here
  global.document = dom.window.document // add the globals needed for the unit tests in this suite.
})

test('simple', t => {
  let div = h('DIV', null, 'test')

  assert.equal(div.innerHTML, 'test')
})

test('updatable', t => {
  const $state = $State({ count: 1 })
  const generator = state => {
    if (state.count === 1) {
      return 'one'
    } else {
      return h('B', null, 'number: ' + state.count)
    }
  }

  let div = h('DIV', null, $F(generator, $state))
  assert.equal(div.innerHTML, 'one')

  $state.count = 2
  assert.equal(div.innerHTML, '<b>number: 2</b>')

  $state.count = 1
  assert.equal(div.innerHTML, 'one')
})
