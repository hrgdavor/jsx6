/**
 * Tests for P2-1 — node disposal / teardown (see plan/disposal-design.md).
 *
 * The first test is the plan's reproduction: before disposal existed, `remove(el)` discarded every
 * `observeNow()` unsubscribe function, so a long-lived signal kept writing into the detached nodes
 * ("the signal fired 4 more updates" after `el.remove()`).
 */
import { afterAll, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { signal } from '@jsx6/signal'

import { disposeNode, domWithScope, h, jsxDisposeSymbol } from './jsx2dom.js'
import { remove } from './remove.js'
import { replace, replaceContent } from './replace.js'
import { Loop } from './Loop.js'
import { Jsx6 } from './Jsx6.js'

GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

const tick = () => new Promise(resolve => setTimeout(resolve, 10))

test('a removed subtree stops receiving signal updates (the P2-1 reproduction)', () => {
  const $v = signal('A')
  const div = domWithScope({}, hFn => hFn('DIV', null, hFn('SPAN', { title: $v }, $v), hFn('B', null, $v)))
  document.body.appendChild(div)
  expect(div.innerHTML).toEqual('<span title="A">A</span><b>A</b>')

  const span = div.querySelector('span')
  $v('B') // the binding still works while the node is attached
  expect(span.getAttribute('title')).toEqual('B')
  expect(span.textContent).toEqual('B')

  remove(div)
  expect(div.isConnected).toEqual(false)

  // Before P2-1 this counted 4: every change still reached the detached subtree.
  const read = () => `${span.getAttribute('title')}|${span.textContent}|${div.querySelector('b').textContent}`
  let updates = 0
  for (const v of ['C', 'D', 'E', 'F']) {
    const before = read()
    $v(v)
    if (read() !== before) updates++
  }
  expect(updates).toEqual(0)
  expect(span.getAttribute('title')).toEqual('B')
  expect(div.innerHTML).toEqual('<span title="B">B</span><b>B</b>')
})

test('disposeNode walks the whole subtree, including nested bound children', () => {
  const $a = signal(1)
  const $b = signal(2)
  const wrapper = domWithScope({}, hFn =>
    hFn('DIV', null, hFn('SECTION', null, hFn('I', { title: $a }, $a)), hFn('EM', null, $b)),
  )
  document.body.appendChild(wrapper)
  const i = wrapper.querySelector('i')
  const em = wrapper.querySelector('em')

  $a(11)
  $b(22)
  expect(i.textContent).toEqual('11')
  expect(em.textContent).toEqual('22')

  // symbol contract: each node keeps its own teardown list
  expect(Array.isArray(i[jsxDisposeSymbol])).toEqual(true)
  expect(i[jsxDisposeSymbol].length).toBeGreaterThan(0)

  const released = disposeNode(wrapper)
  expect(released).toBeGreaterThan(0)
  expect(wrapper.isConnected).toEqual(true) // disposal never detaches

  $a(111)
  $b(222)
  expect(i.textContent).toEqual('11')
  expect(em.textContent).toEqual('22')
  expect(i[jsxDisposeSymbol].length).toEqual(0)

  remove(wrapper)
})

test('disposeNode is idempotent', () => {
  const $v = signal('x')
  const el = domWithScope({}, hFn => hFn('DIV', null, hFn('SPAN', { title: $v })))
  document.body.appendChild(el)

  expect(disposeNode(el)).toBeGreaterThan(0)
  expect(disposeNode(el)).toEqual(0)
  expect(() => disposeNode(el)).not.toThrow()

  remove(el)
})

test('a node with no subscriptions disposes cleanly', () => {
  const plain = document.createElement('div')
  plain.appendChild(document.createElement('span'))
  document.body.appendChild(plain)

  expect(disposeNode(plain)).toEqual(0)
  expect(disposeNode(document.createTextNode('t'))).toEqual(0)
  expect(disposeNode({})).toEqual(0)
  expect(disposeNode('text')).toEqual(0)
  expect(disposeNode(null)).toEqual(0)
  expect(() => disposeNode(undefined)).not.toThrow()

  remove(plain)
  expect(plain.isConnected).toEqual(false)
})

test('listeners added through attributes are removed with the node', () => {
  let clicks = 0
  const button = domWithScope({}, hFn => hFn('BUTTON', { onclick: () => clicks++ }, 'go'))
  document.body.appendChild(button)

  button.dispatchEvent(new Event('click'))
  expect(clicks).toEqual(1)

  disposeNode(button)
  button.dispatchEvent(new Event('click'))
  expect(clicks).toEqual(1)
  expect(disposeNode(button)).toEqual(0)

  remove(button)
})

test('directive bindings (x-if) are released with the node', () => {
  const $show = signal(true)
  const host = domWithScope({}, hFn => hFn('DIV', null, hFn('SPAN', { 'x-if': $show }, 's')))
  document.body.appendChild(host)
  const span = host.querySelector('span')

  expect(span.hasAttribute('hidden')).toEqual(false)
  $show(false)
  expect(span.hasAttribute('hidden')).toEqual(true)

  remove(host)
  $show(true)
  expect(span.hasAttribute('hidden')).toEqual(true) // frozen at its last value

  expect(span.isConnected).toEqual(false)
})

test('replace() and replaceContent() dispose the outgoing content', () => {
  const $v = signal('a')
  const parent = document.createElement('div')
  document.body.appendChild(parent)

  const old = domWithScope({}, hFn => hFn('SPAN', { title: $v }, $v))
  parent.appendChild(old)
  replace(document.createElement('i'), old)
  $v('b')
  expect(old.getAttribute('title')).toEqual('a')
  expect(old.textContent).toEqual('a')
  expect(parent.innerHTML).toEqual('<i></i>')

  const $s = signal('x')
  const child = domWithScope({}, hFn => hFn('SPAN', { title: $s }, $s))
  parent.appendChild(child)
  $s('y')
  expect(child.getAttribute('title')).toEqual('y')

  replaceContent(parent, document.createElement('b'))
  $s('z')
  expect(child.getAttribute('title')).toEqual('y')
  expect(parent.innerHTML).toEqual('<b></b>')

  remove(parent)
})

test('Jsx6 ondestroy() runs exactly once when the component is disposed', () => {
  let destroyed = 0
  class Widget extends Jsx6 {
    tpl() {
      return h('DIV', null, 'widget')
    }
    ondestroy() {
      destroyed++
    }
  }

  const w = new Widget()
  document.body.appendChild(w.el)
  expect(destroyed).toEqual(0)

  remove(w)
  expect(destroyed).toEqual(1)
  expect(w.el.isConnected).toEqual(false)

  // the hook is part of the node's teardown list, so it is released only once
  expect(disposeNode(w)).toEqual(0)
  expect(destroyed).toEqual(1)
})

test('Loop hides evicted items for reuse and only releases them on request', () => {
  const scope = {}
  const Item = ({ value }) => h('B', null, value.x)
  const div = domWithScope(scope, hFn => hFn('DIV', null, hFn(Loop, { item: Item, p: 'loop' })))
  document.body.appendChild(div)
  const loop = scope.loop

  loop.setValue([{ x: 1 }, { x: 2 }, { x: 3 }])
  expect(div.innerHTML).toEqual('<b>1</b><b>2</b><b>3</b>')

  // shrinking detaches items 2 and 3, but they stay in allItems for reuse
  loop.setValue([{ x: 1 }])
  expect(div.innerHTML).toEqual('<b>1</b>')
  expect(loop.allItems.length).toEqual(3)

  // re-growing reuses the detached node *and* its still-live bindings
  loop.setValue([{ x: 1 }, { x: 4 }])
  expect(div.innerHTML).toEqual('<b>1</b><b>4</b>')

  // disposeItem() is the permanent path: bindings released, item dropped from allItems
  const item = loop.getItem(1)
  expect(loop.disposeItem(item)).toBe(item)
  expect(div.innerHTML).toEqual('<b>1</b>')
  expect(loop.allItems.length).toEqual(2)
  item.setValue({ x: 99 })
  expect(item.el.textContent).toEqual('4') // frozen: the binding is gone
  expect(disposeNode(item.el)).toEqual(0)

  expect(loop.disposeItem('not an item')).toBeUndefined()

  remove(div)
})

test('Loop.dispose() releases every item, including the hidden ones', () => {
  const scope = {}
  const Item = ({ value }) => h('B', null, value.x)
  const div = domWithScope(scope, hFn => hFn('DIV', null, hFn(Loop, { item: Item, p: 'loop' })))
  document.body.appendChild(div)
  const loop = scope.loop

  loop.setValue([{ x: 1 }, { x: 2 }, { x: 3 }])
  loop.setValue([{ x: 1 }]) // two hidden items are retained for reuse
  const visible = loop.getItem(0)
  const hidden = loop.allItems[1]

  expect(loop.dispose()).toBe(loop)
  expect(loop.allItems).toEqual([])
  expect(loop.count).toEqual(0)

  visible.setValue({ x: 8 })
  hidden.setValue({ x: 9 })
  expect(visible.el.textContent).toEqual('1')
  expect(hidden.el.textContent).toEqual('2')

  expect(loop.dispose()).toBe(loop) // idempotent
  expect(disposeNode(loop)).toEqual(0) // a component can be disposed directly

  remove(div)
})

test('removing a container tears down its Loop, including the value subscription', async () => {
  const $items = signal([{ x: 1 }, { x: 2 }])
  const scope = {}
  const Item = ({ value }) => h('B', null, value.x)
  const div = domWithScope(scope, hFn => hFn('DIV', null, hFn(Loop, { item: Item, p: 'loop', value: $items })))
  document.body.appendChild(div)
  const loop = scope.loop

  await tick() // the Loop constructor subscribes on a timer
  expect(div.innerHTML).toEqual('<b>1</b><b>2</b>')

  remove(div)
  const frozen = div.innerHTML
  $items([{ x: 9 }])
  await tick()

  expect(div.innerHTML).toEqual(frozen)
  expect(loop.allItems).toEqual([])
})