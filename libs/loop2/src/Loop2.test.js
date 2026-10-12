/**
 * Tests for `@jsx6/loop2`.
 *
 * They cover (a) the contract `Loop2` shares with `@jsx6/jsx6`'s `Loop`, so a migration is a
 * rename, and (b) the four behavioural differences plan/loop2-plan.md promises: `keyBy`, keyed
 * primitives, the bounded reuse pool, and the unified mutation API.
 *
 * Style matches `libs/jsx6/src/Loop.test.js`: happy-dom registered globally, items built with the
 * `h` factory (no JSX transform needed).
 */
import { afterAll, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { signal } from '@jsx6/signal'
import { domWithScope, h, Jsx6, remove } from '@jsx6/jsx6'

import { Loop2, Loop2Item } from './Loop2.js'

GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

const tick = () => new Promise(resolve => setTimeout(resolve, 10))
/** keyed data the way plan/keyed-loop-design.md §2.4 recommends: the key lives on the datum */
const keyed = ($key, x) => ({ $key, x })

const Item = ({ value }) => h('B', null, value.x)

/** Build a loop inside a container through the jsx runtime (`p` assigns it to the scope). */
const mount = (opts = {}, scope = {}) => {
  const div = domWithScope(scope, hFn =>
    hFn('DIV', null, hFn(Loop2, { item: Item, p: 'loop', ...opts }), 'test'),
  )
  return { div, loop: scope.loop }
}

// ---------------------------------------------------------------------------------------------
// parity with Loop
// ---------------------------------------------------------------------------------------------

test('renders, updates and clears a plain list', () => {
  const { div, loop } = mount()
  expect(div.innerHTML).toEqual('test')

  loop.setValue([{ x: 11 }, { x: 12 }])
  expect(div.innerHTML).toEqual('<b>11</b><b>12</b>test')
  expect(loop.size()).toEqual(2)
  expect(loop.length).toEqual(2)
  expect(loop.getValue().map(v => v.x)).toEqual([11, 12])
  expect(loop.getData().map(v => v.x)).toEqual([11, 12])

  loop.setValue([{ x: 13 }])
  expect(div.innerHTML).toEqual('<b>13</b>test')
  expect(loop.getData().map(v => v.x)).toEqual([13])

  loop.setValue([])
  expect(div.innerHTML).toEqual('test')
  expect(loop.size()).toEqual(0)
})

test('supports primitive values', () => {
  const { div, loop } = mount({ primitive: true, item: ({ value }) => value })
  loop.setValue([11, 12])
  expect(div.innerHTML).toEqual('1112test')
  expect(loop.getValue()).toEqual([11, 12])

  loop.setValue([11, 12, 13])
  expect(div.innerHTML).toEqual('111213test')
})

test('unkeyed data keeps index-based reuse and registers no keys', () => {
  const { div, loop } = mount()
  const rows = [{ x: 1 }, { x: 2 }, { x: 3 }]
  loop.setValue(rows)
  const items = loop.getItems()

  loop.setValue([{ x: 3 }, { x: 2 }, { x: 1 }])
  expect(div.innerHTML).toEqual('<b>3</b><b>2</b><b>1</b>test')
  // same instances, same nodes, values swapped in place
  expect(loop.getItem(0)).toBe(items[0])
  expect(loop.getItem(2)).toBe(items[2])
  expect(loop.getValue().map(v => v.x)).toEqual([3, 2, 1])
  expect(loop.keyMap.size).toEqual(0)
})

test('moveItem keeps the ordering semantics Loop documents', () => {
  const { div, loop } = mount()
  loop.setValue([{ x: 1 }, { x: 2 }, { x: 3 }])

  // "move item 0 before the item the caller saw at index 2" → [2, 1, 3]
  loop.moveItem(0, 2)
  expect(div.innerHTML).toEqual('<b>2</b><b>1</b><b>3</b>test')

  // move the last entry to the front
  loop.moveItem(2, 0)
  expect(div.innerHTML).toEqual('<b>3</b><b>2</b><b>1</b>test')
  expect(loop.getData().map(d => d.x)).toEqual([3, 2, 1])
})

test('splice inserts, removes and returns the removed data', () => {
  const { div, loop } = mount()
  loop.setValue([keyed('a', 1), keyed('b', 2), keyed('c', 3)])
  const [A, , C] = loop.getItems()

  const removed = loop.splice(1, 1, keyed('n', 9))
  expect(removed.map(d => d.x)).toEqual([2])
  expect(div.innerHTML).toEqual('<b>1</b><b>9</b><b>3</b>test')
  expect(loop.size()).toEqual(3)
  // the keyed neighbours were moved, not rebuilt
  expect(loop.getItem(0)).toBe(A)
  expect(loop.getItem(2)).toBe(C)

  loop.splice(0, 2)
  expect(div.innerHTML).toEqual('<b>3</b>test')
  expect(loop.size()).toEqual(1)
})

test('push and pop reuse the same parked instance', () => {
  const { div, loop } = mount()
  loop.setValue([keyed('a', 1), keyed('b', 2)])
  const [, B] = loop.getItems()
  B.mutationMark = 'B'

  const popped = loop.pop()
  expect(popped).toBe(B)
  expect(div.innerHTML).toEqual('<b>1</b>test')
  expect(loop.size()).toEqual(1)
  // parked, not disposed: the node is detached but stays in allItems for reuse
  expect(loop.allItems).toContain(B)
  expect(B.el.parentNode).toBe(null)

  const pushed = loop.push(keyed('b', 22))
  expect(pushed).toBe(B)
  expect(pushed.mutationMark).toEqual('B')
  expect(div.innerHTML).toEqual('<b>1</b><b>22</b>test')
})

test('setItem grows the list at the end and refuses a hole', () => {
  const { div, loop } = mount({ keyBy: row => row.id })
  loop.setValue([{ id: 'a', x: 1 }])

  const added = loop.setItem({ id: 'b', x: 2 }, 1)
  expect(div.innerHTML).toEqual('<b>1</b><b>2</b>test')
  expect(loop.size()).toEqual(2)
  expect(loop.getItemByKey('b')).toBe(added)

  loop.setItem({ id: 'a', x: 11 }, 0)
  expect(div.innerHTML).toEqual('<b>11</b><b>2</b>test')
  expect(loop.getItemByKey('a')).toBe(loop.getItem(0))

  expect(() => loop.setItem({ id: 'x', x: 9 }, 5)).toThrow(RangeError)
})

test('removeItem removes a visible entry and throws for an unknown one', () => {
  const { div, loop } = mount()
  loop.setValue([keyed('a', 1), keyed('b', 2), keyed('c', 3)])
  const [A, B] = loop.getItems()

  loop.removeItem(A)
  expect(div.innerHTML).toEqual('<b>2</b><b>3</b>test')
  expect(loop.size()).toEqual(2)
  expect(loop.getItemByKey('b')).toBe(B)

  expect(() => loop.removeItem({ notInLoop: true })).toThrow()
})

test('a key written in the item template participates in matching', () => {
  const { div, loop } = mount({ item: ({ value }) => h('B', { key: value.id }, value.x) })
  const rows = [
    { id: 'a', x: 1 },
    { id: 'b', x: 2 },
  ]
  loop.setValue(rows)
  const [A, B] = loop.getItems()
  expect(A.el.getAttribute('key')).toEqual('a')
  expect(loop.getItemByKey('a')).toBe(A)

  // the same datum objects, reordered: the learned template key moves the right instances
  loop.setValue([rows[1], rows[0]])
  // (the item template's own `key={value.id}` also mirrors a `key` attribute into the DOM — a
  // pre-existing `insertAttr` behaviour, see plan/keyed-loop-design.md §2.1)
  expect(div.innerHTML).toEqual('<b key="b">2</b><b key="a">1</b>test')
  expect(loop.getItem(0)).toBe(B)
  expect(loop.getItem(1)).toBe(A)
})

test('a class component item keeps its state across a keyed reorder', () => {
  class Row extends Jsx6 {
    clicks = 0
    tpl() {
      return h('B', null, this.$v.x)
    }
  }

  const { div, loop } = mount({ item: Row })
  loop.setValue([keyed('a', 1), keyed('b', 2), keyed('c', 3)])
  const rows = loop.getItems()
  rows[1].clicks = 7

  loop.setValue([keyed('c', 3), keyed('b', 2), keyed('a', 1)])
  expect(div.innerHTML).toEqual('<b>3</b><b>2</b><b>1</b>test')
  expect(loop.getItem(1)).toBe(rows[1])
  expect(loop.getItem(1).clicks).toEqual(7)
})

// ---------------------------------------------------------------------------------------------
// keyBy
// ---------------------------------------------------------------------------------------------

test('keyBy matches brand-new datum objects (the documented Loop limitation, fixed)', () => {
  const { div, loop } = mount({ keyBy: row => row.id })
  loop.setValue([
    { id: 'a', x: 1 },
    { id: 'b', x: 2 },
  ])
  const [A, B] = loop.getItems()
  A.mutationMark = 'A'

  // every update passes fresh objects — no $key on the data, no template key
  loop.setValue([
    { id: 'b', x: 2 },
    { id: 'a', x: 1 },
  ])
  expect(div.innerHTML).toEqual('<b>2</b><b>1</b>test')
  expect(loop.getItem(0)).toBe(B)
  expect(loop.getItem(1)).toBe(A)
  expect(loop.getItem(1).mutationMark).toEqual('A')
  expect(loop.getItemByKey('a')).toBe(A)
  expect(loop.getKey(A)).toEqual('a')
})

test('keyBy also accepts the index and resolves signal-valued keys', () => {
  const { div, loop } = mount({ keyBy: (row, i) => row.id ?? `row-${i}` })
  loop.setValue([{ x: 1 }, { x: 2 }, { id: 'c', x: 3 }])
  expect(div.innerHTML).toEqual('<b>1</b><b>2</b><b>3</b>test')
  expect(loop.getItemByKey('row-0')).toBe(loop.getItem(0))
  expect(loop.getItemByKey('c')).toBe(loop.getItem(2))
  expect(loop.keyMap.size).toEqual(3)
})

test('keyBy makes keyed primitive loops possible', () => {
  const { div, loop } = mount({ primitive: true, item: ({ value }) => value, keyBy: v => v })
  loop.setValue([1, 2, 3])
  const [, B] = loop.getItems()
  B.mutationMark = 'two'

  loop.setValue([3, 2, 1])
  expect(div.innerHTML).toEqual('321test')
  expect(loop.getItem(1)).toBe(B)
  expect(loop.getItem(1).mutationMark).toEqual('two')
})

test('strictKeys gives a never-seen key a fresh instance instead of the freed slot', () => {
  const build = strictKeys => {
    let built = 0
    const scope = {}
    const div = domWithScope(scope, hFn =>
      hFn(
        'DIV',
        null,
        hFn(Loop2, {
          item: Item,
          p: 'loop',
          keyBy: row => row.id,
          strictKeys,
          onBuild: () => built++,
        }),
        'test',
      ),
    )
    return { div, loop: scope.loop, built: () => built }
  }

  // default: the item that sat at the replaced index is reused (Loop's documented behaviour)
  const loose = build(false)
  loose.loop.setValue([
    { id: 'a', x: 1 },
    { id: 'b', x: 2 },
    { id: 'c', x: 3 },
  ])
  const looseB = loose.loop.getItem(1)
  looseB.mutationMark = 'b'
  loose.loop.setValue([
    { id: 'a', x: 1 },
    { id: 'n', x: 9 },
    { id: 'c', x: 3 },
  ])
  expect(loose.loop.getItem(1)).toBe(looseB)
  expect(loose.loop.getItem(1).mutationMark).toEqual('b')
  expect(loose.div.innerHTML).toEqual('<b>1</b><b>9</b><b>3</b>test')
  expect(loose.built()).toEqual(3)

  // strictKeys: a new key never inherits the state of the entry it replaced
  const strict = build(true)
  strict.loop.setValue([
    { id: 'a', x: 1 },
    { id: 'b', x: 2 },
    { id: 'c', x: 3 },
  ])
  const strictB = strict.loop.getItem(1)
  strictB.mutationMark = 'b'
  strict.loop.setValue([
    { id: 'a', x: 1 },
    { id: 'n', x: 9 },
    { id: 'c', x: 3 },
  ])
  expect(strict.div.innerHTML).toEqual('<b>1</b><b>9</b><b>3</b>test')
  expect(strict.loop.getItem(1)).not.toBe(strictB)
  expect(strict.loop.getItem(1).mutationMark).toBeUndefined()
  expect(strict.loop.getItemByKey('n')).toBe(strict.loop.getItem(1))
  expect(strict.built()).toEqual(4)
})

// ---------------------------------------------------------------------------------------------
// reuse pool, disposal
// ---------------------------------------------------------------------------------------------

test('the default pool never disposes on hide', () => {
  const { div, loop } = mount()
  loop.setValue([{ x: 1 }, { x: 2 }, { x: 3 }])
  const nodes = loop.getItems().map(i => i.el)

  loop.setValue([{ x: 1 }])
  expect(div.innerHTML).toEqual('<b>1</b>test')
  expect(loop.allItems.length).toEqual(3)
  expect(nodes[1].parentNode).toBe(null)

  // re-growing reuses the detached instances and their still-live bindings
  loop.setValue([{ x: 1 }, { x: 4 }])
  expect(div.innerHTML).toEqual('<b>1</b><b>4</b>test')
  expect(loop.getItem(1).el).toBe(nodes[1])
})

test('maxPooled bounds the retained items and onRelease reports them', () => {
  const released = []
  const { div, loop } = mount({ maxPooled: 1, onRelease: item => released.push(item) })
  loop.setValue([{ x: 1 }, { x: 2 }, { x: 3 }])

  loop.setValue([{ x: 1 }])
  expect(loop.allItems.length).toEqual(2) // 1 visible + 1 parked
  expect(released.length).toEqual(1)
  expect(div.innerHTML).toEqual('<b>1</b>test')

  // the loop still renders correctly after the trim, and rebuilding is the documented cost
  loop.setValue([{ x: 1 }, { x: 8 }, { x: 9 }])
  expect(div.innerHTML).toEqual('<b>1</b><b>8</b><b>9</b>test')

  // explicit trimming down to nothing
  loop.setValue([{ x: 1 }])
  expect(loop.releasePool(0)).toEqual(1)
  expect(loop.allItems.length).toEqual(1)
  expect(loop.size()).toEqual(1)
})

test('disposeItem releases one item and removes its data entry', () => {
  const { div, loop } = mount()
  loop.setValue([keyed('a', 1), keyed('b', 2), keyed('c', 3)])

  const [A, B] = loop.getItems()
  B.mutationMark = 'B'
  expect(loop.disposeItem(B)).toBe(B)
  expect(loop.size()).toEqual(2)
  expect(loop.allItems.length).toEqual(2) // dropped for good, not parked
  expect(loop.getData().map(d => d.x)).toEqual([1, 3])
  expect(div.innerHTML).toEqual('<b>1</b><b>3</b>test')
  expect(loop.getItemByKey('b')).toBeUndefined()

  // after disposal the key is free again: a fresh item is built for it
  loop.setValue([keyed('a', 1), keyed('b', 4), keyed('c', 3)])
  expect(loop.getItem(1)).not.toBe(B)
  expect(loop.getItem(1).mutationMark).toBeUndefined()
  expect(loop.getItem(0)).toBe(A)
  expect(loop.disposeItem('not an item')).toBeUndefined()
})

test('a parked item keeps its bindings; disposeItem freezes it', () => {
  const { loop } = mount()
  loop.setValue([keyed('a', 1), keyed('b', 2)])
  const [, B] = loop.getItems()

  loop.setValue([keyed('a', 1)]) // B is parked and must stay bound
  B.setValue({ $key: 'b', x: 42 })
  expect(B.el.textContent).toEqual('42')

  expect(loop.disposeItem(B)).toBe(B)
  B.setValue({ $key: 'b', x: 99 })
  expect(B.el.textContent).toEqual('42') // frozen: the binding is gone
})

test('dispose() releases every item, including the parked ones', () => {
  const { loop } = mount()
  loop.setValue([{ x: 1 }, { x: 2 }, { x: 3 }])
  loop.setValue([{ x: 1 }])
  const visible = loop.getItem(0)
  const hidden = loop.allItems[1]

  expect(loop.dispose()).toBe(loop)
  expect(loop.allItems).toEqual([])
  expect(loop.count).toEqual(0)
  expect(loop.keyMap.size).toEqual(0)
  expect(loop.getData()).toEqual([])

  visible.setValue({ x: 8 })
  hidden.setValue({ x: 9 })
  expect(visible.el.textContent).toEqual('1')
  expect(hidden.el.textContent).toEqual('2')

  expect(loop.dispose()).toBe(loop) // idempotent
})

test('removing a container tears down its loop, including the value subscription', async () => {
  const $items = signal([{ x: 1 }, { x: 2 }])
  const scope = {}
  const div = domWithScope(scope, hFn =>
    hFn('DIV', null, hFn(Loop2, { item: Item, p: 'loop', value: $items })),
  )
  document.body.appendChild(div)
  const loop = scope.loop

  await tick() // the constructor subscribes on a timer
  expect(div.innerHTML).toEqual('<b>1</b><b>2</b>')

  remove(div)
  const frozen = div.innerHTML
  $items([{ x: 9 }])
  await tick()

  expect(div.innerHTML).toEqual(frozen)
  expect(loop.allItems).toEqual([])
})

test('the value signal drives the loop', async () => {
  const $items = signal([{ x: 1 }])
  const scope = {}
  const div = domWithScope(scope, hFn =>
    hFn('DIV', null, hFn(Loop2, { item: Item, p: 'loop', value: $items })),
  )
  const loop = scope.loop

  await tick()
  expect(div.innerHTML).toEqual('<b>1</b>')

  $items([{ x: 1 }, { x: 2 }])
  await tick()
  expect(div.innerHTML).toEqual('<b>1</b><b>2</b>')
  expect(loop.size()).toEqual(2)
})

// ---------------------------------------------------------------------------------------------
// DOM, detach, fragments, custom builder
// ---------------------------------------------------------------------------------------------

test('DOM is only mutated when the order actually changes', () => {
  const { div, loop } = mount({ keyBy: row => row.id })
  loop.setValue([keyed('a', 1), keyed('b', 2), keyed('c', 3)])

  let moves = 0
  const nativeInsertBefore = div.insertBefore.bind(div)
  div.insertBefore = (...args) => {
    moves++
    return nativeInsertBefore(...args)
  }

  loop.setValue([keyed('a', 1), keyed('b', 2), keyed('c', 3)])
  expect(moves).toEqual(0) // same data: no DOM work at all

  // [a,b,c] → [b,c,a] is one move: only `a` changed place, `b` and `c` are already right
  loop.setValue([keyed('b', 2), keyed('c', 3), keyed('a', 1)])
  expect(moves).toEqual(1)
  expect(div.innerHTML).toEqual('<b>2</b><b>3</b><b>1</b>test')

  // [b,c,a] → [a,c,b] is two moves
  loop.setValue([keyed('a', 1), keyed('c', 3), keyed('b', 2)])
  expect(moves).toEqual(3)
  expect(div.innerHTML).toEqual('<b>1</b><b>3</b><b>2</b>test')

  // unkeyed data reorders the *content*, not the nodes: the instances stay where they are
  const plain = mount()
  plain.loop.setValue([{ x: 1 }, { x: 2 }, { x: 3 }])
  let plainMoves = 0
  const plainNative = plain.div.insertBefore.bind(plain.div)
  plain.div.insertBefore = (...args) => {
    plainMoves++
    return plainNative(...args)
  }
  const before = plain.loop.getItems()[0]
  plain.loop.setValue([{ x: 3 }, { x: 2 }, { x: 1 }])
  expect(plainMoves).toEqual(0)
  expect(plain.loop.getItems()[0]).toBe(before)
  expect(plain.div.innerHTML).toEqual('<b>3</b><b>2</b><b>1</b>test')
})

test('a loop populated before it is attached renders after refresh()', () => {
  const loop = new Loop2({ item: Item })
  expect(() => loop.setValue([{ x: 1 }, { x: 2 }])).not.toThrow()
  expect(loop.size()).toEqual(2)
  expect(loop.items[0].el.parentNode).toBe(null)

  const div = document.createElement('DIV')
  div.appendChild(loop.el)
  loop.refresh()
  expect(div.innerHTML).toEqual('<b>1</b><b>2</b>')

  loop.setValue([{ x: 2 }, { x: 1 }])
  expect(div.innerHTML).toEqual('<b>2</b><b>1</b>')
})

test('an item template may render a fragment of nodes', () => {
  const Frag = ({ value }) => [h('B', null, value.x), h('I', null, value.y)]
  const { div, loop } = mount({ item: Frag })
  loop.setValue([
    { $key: 'a', x: 1, y: 'a' },
    { $key: 'b', x: 2, y: 'b' },
  ])
  expect(div.innerHTML).toEqual('<b>1</b><i>a</i><b>2</b><i>b</i>test')

  const second = loop.getItem(1)
  loop.setValue([
    { $key: 'b', x: 2, y: 'b' },
    { $key: 'a', x: 1, y: 'a' },
  ])
  expect(div.innerHTML).toEqual('<b>2</b><i>b</i><b>1</b><i>a</i>test')
  expect(loop.getItem(0)).toBe(second)

  // both nodes of a fragment are indexed, so a node can be used to address its item
  expect(loop.getItemIndex(second.el[1])).toEqual(0)
  loop.removeItem(second.el[1])
  expect(div.innerHTML).toEqual('<b>1</b><i>a</i>test')
})

test('a custom builder is called once per built item', () => {
  let built = 0
  const builder = opts => {
    built++
    return Loop2Item(opts)
  }
  const { div, loop } = mount({ builder, keyBy: row => row.id })

  loop.setValue([
    { id: 'a', x: 1 },
    { id: 'b', x: 2 },
  ])
  expect(built).toEqual(2)

  loop.setValue([
    { id: 'b', x: 2 },
    { id: 'a', x: 1 },
  ])
  expect(div.innerHTML).toEqual('<b>2</b><b>1</b>test')
  expect(built).toEqual(2) // moved, never rebuilt
})

test('duplicate keys: the first occurrence owns the item and nothing crashes', () => {
  const { div, loop } = mount({ keyBy: row => row.id })
  loop.setValue([
    { id: 'a', x: 1 },
    { id: 'a', x: 2 },
  ])
  expect(div.innerHTML).toEqual('<b>1</b><b>2</b>test')
  expect(loop.size()).toEqual(2)
  expect(loop.getItemByKey('a')).toBe(loop.getItem(0))

  loop.setValue([
    { id: 'a', x: 2 },
    { id: 'a', x: 1 },
  ])
  expect(div.innerHTML).toEqual('<b>2</b><b>1</b>test')
  expect(loop.size()).toEqual(2)
})

test('keyed and unkeyed data coexist', () => {
  const { div, loop } = mount({ keyBy: row => row.id })
  loop.setValue([{ id: 'a', x: 1 }, { x: 2 }])
  const [A] = loop.getItems()

  loop.setValue([{ x: 2 }, { id: 'a', x: 1 }])
  expect(div.innerHTML).toEqual('<b>2</b><b>1</b>test')
  expect(loop.getItem(1)).toBe(A)
})
