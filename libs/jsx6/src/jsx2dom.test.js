import test from 'ava'
import { makeState, setAnimFunction } from './makeState.js'
import { h } from './jsx2dom.js'

import { JSDOM } from 'jsdom'

test.before(() => {
  const dom = new JSDOM('<div id="my-element-id" />') // insert any html needed for the unit test suite here
  global.document = dom.window.document // add the globals needed for the unit tests in this suite.
})

// call immediately to update state values without async (simpler testing)
setAnimFunction(f => f())

test('simple', t => {
  let div = h('DIV', null, 'test')

  t.is(div.innerHTML, 'test')
})

test('updatable', t => {
  const $state = makeState({ count: 1 })
  const generator = state => {
    if (state.count === 1) {
      return 'one'
    } else {
      return h('B', null, 'number: ' + state.count)
    }
  }

  let div = h('DIV', null, $state(generator))
  t.is(div.innerHTML, 'one')

  $state.count = 2
  t.is(div.innerHTML, '<b>number: 2</b>')

  $state.count = 1
  t.is(div.innerHTML, 'one')
})
