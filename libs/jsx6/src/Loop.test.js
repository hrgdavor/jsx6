import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { domWithScope, h } from './jsx2dom.js'
import { Loop } from './Loop.js'

import { JSDOM } from 'jsdom'

test.before(() => {
  const dom = new JSDOM('<div id="my-element-id" />') // insert any html needed for the unit test suite here
  global.document = dom.window.document // add the globals needed for the unit tests in this suite.
})

test('simple', t => {
  const Item = ({ value }) => h('B', null, value.x)

  const scope = {}
  let div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  assert.equal(div.innerHTML, 'test')
  scope.loop.setValue([{ x: 11 }, { x: 12 }])
  assert.equal(div.innerHTML, '<b>11</b><b>12</b>test')

  div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: ({ value }) => value.x, p: 'loop' }), 'test'))
  assert.equal(div.innerHTML, 'test')
  scope.loop.setValue([{ x: 11 }, { x: 12 }])
  assert.equal(div.innerHTML, '1112test')

  div = domWithScope(scope, h =>
    h('DIV', null, h(Loop, { primitive: true, item: ({ value }) => value, p: 'loop' }), 'test'),
  )
  assert.equal(div.innerHTML, 'test')
  scope.loop.setValue([11, 12])
  assert.equal(div.innerHTML, '1112test')
})

test('simple and primitive values', t => {
  const Item = ({ value }) => h('B', null, value.x)

  const scope = {}
  let div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  assert.equal(div.innerHTML, 'test')
  scope.loop.setValue([{ x: 11 }, { x: 12 }])
  assert.equal(div.innerHTML, '<b>11</b><b>12</b>test')
})

// TODO test loop element reordering or removing without using setVisible
// without the setVisible we are also free to have textNodes and not just Elements(tags)
