import { expect, test, afterAll } from 'bun:test'
import { domWithScope, getScope, h } from './jsx2dom.js'

import { $State, $F, observe } from '@jsx6/signal'

import { GlobalRegistrator } from '@happy-dom/global-registrator'

globalThis.oldConsole = console
GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

test('simple', () => {
  // <div>test</div>
  let div = h('DIV', null, 'test')

  expect(div.innerHTML).toEqual('test')
})

test('updatable', () => {
  const $state = $State({ count: 1 })
  const generator = state => {
    console.log('$stateX', state, $state().count, $state.count())
    if (state.count === 1) {
      return 'one'
    } else if (state.count === 2) {
      return [h('B', null, 'number: ' + state.count), 'A']
    } else {
      return h('B', null, 'number: ' + state.count)
    }
  }
  observe($state, () => {
    // console.log('$state', $state())
  })
  let $body = $F(generator, $state)
  observe($body, () => {
    console.log('$body', $body() + '')
  })

  let div = h('DIV', null, $body)
  expect(div.innerHTML).toEqual('one')
  console.log('sssssssssssssssssss')
  $state.count = 2
  console.log('CCCCCCCCCCCCCCCCCCCC ' + div.children.length)
  expect(div.innerHTML).toEqual('<b>number: 2</b>A')

  $state.count = 1
  // expect(div.innerHTML).toEqual('one')

  $state.count = 3
  // expect(div.innerHTML).toEqual('<b>number: 3</b>')
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
