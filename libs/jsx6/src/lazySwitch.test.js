import test from 'ava'
import { makeState, setAnimFunction } from './makeState.js'
import { $S } from './combineState.js'
import { h } from './jsx2dom.js'
import { lazySwitchValue, lazyShow, lazySwitch } from './lazySwitch.js'

import { JSDOM } from 'jsdom'

test.before(() => {
  const dom = new JSDOM('<div id="my-element-id" />') // insert any html needed for the unit test suite here
  global.document = dom.window.document // add the globals needed for the unit tests in this suite.
})

test('lazyFlip', t => {
  const $state = makeState({ count: 1 })
  let seq = 1
  const indexer = state => (state.count === 1 ? 0 : 1)
  const noData = 'no data' // does not have to be a generator function
  const content = v => h('B', null, 'number: ', $state.count, '/', seq++)

  let div = h('DIV', null, lazySwitch(indexer, $state, noData, content))
  t.is(div.innerHTML, 'no data')

  $state.count = 2
  t.is(div.innerHTML, '<b>number: 2/1</b>')

  $state.count = 1
  t.is(div.innerHTML, 'no data')

  $state.count = 3
  t.is(div.innerHTML, '<b>number: 3/1</b>')
})

test('simpleFlip', t => {
  const $state = makeState({ count: 1 })
  let seq = 1
  const indexer = state => (state.count === 1 ? 0 : 1)
  const content = h('B', null, 'number: ', $state.count, '/', seq++)

  let div = h('DIV', null, lazySwitch(indexer, $state, 'no data', content))
  t.is(div.innerHTML, 'no data')

  $state.count = 2
  t.is(div.innerHTML, '<b>number: 2/1</b>')

  $state.count = 1
  t.is(div.innerHTML, 'no data')

  $state.count = 3
  t.is(div.innerHTML, '<b>number: 3/1</b>')
})

test('simpleFlip string keys', t => {
  const $state = makeState({ part: 'a', count: 1 })
  let seq = 1
  const content = v => h('B', null, 'number: ', $state.part, '/', seq++)

  let div = h('DIV', null, lazySwitchValue($state.part, { a: 'no data', b: content }))
  t.is(div.innerHTML, 'no data')

  $state.part = 'b'
  t.is(div.innerHTML, '<b>number: b/1</b>')

  $state.part = 'a'
  t.is(div.innerHTML, 'no data')

  $state.part = 'b'
  t.is(div.innerHTML, '<b>number: b/1</b>')

  $state.part = 'c'
  t.is(div.innerHTML, '')
})

test('lazyShow', t => {
  const $state = makeState({ count: 0 })
  let seq = 1
  const content = v => h('B', null, 'number: ', $state.count, '/', seq++)

  let div = h('DIV', null, lazyShow($state.count, content))
  t.is(div.innerHTML, '')

  $state.count = 2
  t.is(div.innerHTML, '<b>number: 2/1</b>')

  $state.count = 0
  t.is(div.innerHTML, '')

  $state.count = 3
  t.is(div.innerHTML, '<b>number: 3/1</b>')
})

test('lazyShow2', t => {
  const $state = makeState({ count: 0, names: [] })
  let seq = 1
  const content = v =>
    h(
      'B',
      null,
      'names: ',
      $S(v => v.join(','), $state.names),
      '/',
      seq++,
    )

  let div = h('DIV', null, lazyShow($state.count, content))
  t.is(div.innerHTML, '')

  $state.count = 2
  $state.names = ['john', 'joe']
  t.is(div.innerHTML, '<b>names: john,joe/1</b>')
  const elemRef = div.firstChild

  $state.count = 0
  t.is(div.innerHTML, '')
  t.is(elemRef === div.firstChild, false)

  $state.count = 3
  $state.names = ['john', 'joe', 'jane']
  t.is(div.innerHTML, '<b>names: john,joe,jane/1</b>')
  t.is(elemRef === div.firstChild, true) // same HTML node is reused with different content inside
})
