import { expect, test, afterAll } from 'bun:test'
import { domWithScope, h } from './jsx2dom.js'
import { Loop } from './Loop.js'

import { GlobalRegistrator } from '@happy-dom/global-registrator'
GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

test('simple', () => {
  const Item = ({ value }) => h('B', null, value.x)

  const scope = {}
  let div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  expect(div.innerHTML).toEqual('test')
  scope.loop.setValue([{ x: 11 }, { x: 12 }])
  expect(div.innerHTML).toEqual('<b>11</b><b>12</b>test')

  div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: ({ value }) => value.x, p: 'loop' }), 'test'))
  expect(div.innerHTML).toEqual('test')
  scope.loop.setValue([{ x: 11 }, { x: 12 }])
  expect(div.innerHTML).toEqual('1112test')

  div = domWithScope(scope, h =>
    h('DIV', null, h(Loop, { primitive: true, item: ({ value }) => value, p: 'loop' }), 'test'),
  )
  expect(div.innerHTML).toEqual('test')
  scope.loop.setValue([11, 12])
  expect(div.innerHTML).toEqual('1112test')
})

test('simple and primitive values', () => {
  const Item = ({ value }) => h('B', null, value.x)

  const scope = {}
  let div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  expect(div.innerHTML).toEqual('test')
  scope.loop.setValue([{ x: 11 }, { x: 12 }])
  expect(div.innerHTML).toEqual('<b>11</b><b>12</b>test')
})

// TODO test loop element reordering or removing without using setVisible
// without the setVisible we are also free to have textNodes and not just Elements(tags)
