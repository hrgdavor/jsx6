import { expect, test, afterAll } from 'bun:test'
import { domWithScope, getScope, h, insert } from './jsx2dom.js'

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

// P0-1: `insert()` used an undefined identifier (`ERR_REQUIRE_PARENT`) and threw a
// ReferenceError instead of the intended parent-required error.
test('insert without a parent reports the parent-required error', () => {
  const errors = []
  const realError = console.error
  console.error = (...args) => errors.push(args.map(a => String(a)).join(' '))
  try {
    expect(() => insert(undefined, 'x')).toThrow()
  } finally {
    console.error = realError
  }
  expect(errors.length).toBe(1)
  expect(errors[0]).toContain('JSX6E8')
})

test('updatable', () => {
  const $state = $State({ count: 1 })
  const generator = state => {
    if (state.count === 1) {
      return 'one'
    } else if (state.count === 2) {
      return [h('B', null, 'number: ' + state.count), 'A']
    } else {
      return h('B', null, 'number: ' + state.count)
    }
  }
  observe($state, () => {})

  let $body = $F(generator, $state)

  let div = h('DIV', null, $body)
  expect(div.innerHTML).toEqual('one')

  $state.count = 2
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
