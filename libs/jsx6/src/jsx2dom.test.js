import { expect, test, afterAll } from 'bun:test'
import { domWithScope, getScope, h } from './jsx2dom.js'

import { $State, $F } from '@jsx6/signal'

import { GlobalRegistrator } from '@happy-dom/global-registrator'
GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

test('simple', () => {
  let div = h('DIV', null, 'test')

  expect(div.innerHTML).toEqual('test')
})

test('updatable', () => {
  const $state = $State({ count: 1 })
  const generator = state => {
    if (state.count === 1) {
      return 'one'
    } else {
      return h('B', null, 'number: ' + state.count)
    }
  }

  let div = h('DIV', null, $F(generator, $state))
  expect(div.innerHTML).toEqual('one')

  $state.count = 2
  expect(div.innerHTML).toEqual('<b>number: 2</b>')

  $state.count = 1
  expect(div.innerHTML).toEqual('one')
})

test('oncreate', () => {
  let mix1 = el => (el.innerHTML = 'test2')
  let div = h('DIV', { oncreate: mix1 }, 'test')

  expect(div.innerHTML).toEqual('test2')

  let mix2 = el => (el.innerHTML += 'test3')
  div = h('DIV', { oncreate: [mix1, mix2] }, 'test')

  expect(div.innerHTML).toEqual('test2test3')
})

test('collectRefs', () => {
  const scope = {}
  const out = domWithScope(scope, () => h('div', {}, h('input', { p: 'name' })))

  let { name } = scope
  // let { name } = getScope()
  expect(name?.tagName).toEqual('INPUT')
})
