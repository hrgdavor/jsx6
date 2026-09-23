import { expect, test, afterAll } from 'bun:test'
import { domWithScope, h } from './jsx2dom.js'
import { Loop, LoopItem } from './Loop.js'
import { Jsx6 } from './Jsx6.js'

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

// P0-3 / P0-4: `moveItem` called an undefined `todomNode` (so it always threw), and the splice
// removal path referenced a `this.itemNextSibling` that was assigned nowhere while inserting each
// removed node before removing it again. These assertions pin the documented ordering semantics.
test('moveItem reorders items and splice keeps sibling order', () => {
  const Item = ({ value }) => h('B', null, value.x)

  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  const loop = scope.loop

  loop.setValue([{ x: 1 }, { x: 2 }, { x: 3 }])
  expect(div.innerHTML).toEqual('<b>1</b><b>2</b><b>3</b>test')

  // insertBefore refers to the item's index in the *original* order:
  // "move item 0 before the item at index 2" leaves [2, 1, 3].
  loop.moveItem(0, 2)
  expect(div.innerHTML).toEqual('<b>2</b><b>1</b><b>3</b>test')

  // allItems is now [2, 1, 3]: move the last item to the front.
  loop.moveItem(2, 0)
  expect(div.innerHTML).toEqual('<b>3</b><b>2</b><b>1</b>test')

  // Remove from the middle: remaining siblings keep their order and the anchor text stays last.
  loop.splice(1, 1)
  expect(div.innerHTML).toEqual('<b>3</b><b>1</b>test')

  // The removed node is reused (not rebuilt) when the loop grows again.
  loop.splice(2, 0, { x: 9 })
  expect(div.innerHTML).toEqual('<b>3</b><b>1</b><b>9</b>test')

  // Shrinking detaches items for reuse; growing again must re-attach and update them.
  loop.setValue([{ x: 7 }])
  expect(div.innerHTML).toEqual('<b>7</b>test')
  expect(loop.size()).toBe(1)

  loop.setValue([{ x: 7 }, { x: 8 }])
  expect(div.innerHTML).toEqual('<b>7</b><b>8</b>test')
  expect(loop.size()).toBe(2)
})

test('removeItem reports a missing item instead of corrupting the list', () => {
  const Item = ({ value }) => h('B', null, value.x)

  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  const loop = scope.loop
  loop.setValue([{ x: 1 }, { x: 2 }])

  const item = loop.getItem(0)
  loop.removeItem(item)
  expect(div.innerHTML).toEqual('<b>2</b>test')

  const errors = []
  const realError = console.error
  console.error = (...args) => errors.push(args.map(a => String(a)).join(' '))
  try {
    expect(() => loop.removeItem({ notInLoop: true })).toThrow()
  } finally {
    console.error = realError
  }
  expect(errors.join('\n')).toContain('JSX6E12')
})

// TODO test loop element reordering or removing without using setVisible
// without the setVisible we are also free to have textNodes and not just Elements(tags)

// ---------------------------------------------------------------------------------------------
// P2-2 keyed reconciliation. `key` used to be inert: `insertAttr` stored `loopKey`/`$key` and
// nothing read them, so a reorder reused the component instances of the *positions*, not of the
// entries. A datum now carries its key in those same `$key`/`loopKey` properties, and an item's
// own JSX `key` is read from the item right after it is built. Matching is key-first, index-second,
// and a matched item is *moved* — never rebuilt — so instance identity, item state and the item's
// signal bindings all survive a reorder. See plan/keyed-loop-design.md.
// ---------------------------------------------------------------------------------------------

/** data carrying an explicit key in the properties `insertAttr` writes for a JSX `key` */
const keyed = (key, x) => ({ $key: key, x })

test('reorder with keys moves the same item instances instead of rebuilding them', () => {
  const Item = ({ value }) => h('B', null, value.x)
  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  const loop = scope.loop

  loop.setValue([keyed('a', 1), keyed('b', 2), keyed('c', 3)])
  expect(div.innerHTML).toEqual('<b>1</b><b>2</b><b>3</b>test')

  const [A, B, C] = loop.getItems()
  const nodes = [A.el, B.el, C.el]

  loop.setValue([keyed('c', 30), keyed('a', 10), keyed('b', 20)])

  expect(div.innerHTML).toEqual('<b>30</b><b>10</b><b>20</b>test')
  // identity: the very same item objects — and their DOM nodes — are still displayed, just moved
  expect(loop.getItem(0)).toBe(C)
  expect(loop.getItem(1)).toBe(A)
  expect(loop.getItem(2)).toBe(B)
  expect(loop.getItem(0).el).toBe(nodes[2])
  expect(loop.getItem(1).el).toBe(nodes[0])
  expect(loop.getItem(2).el).toBe(nodes[1])
  // the key map knows which instance owns which key
  expect(loop.getItemByKey('a')).toBe(A)
  expect(loop.getItemByKey('b')).toBe(B)
  expect(loop.getItemByKey('c')).toBe(C)
  // values followed the instances, and each item still reports its own data
  expect(loop.getItem(1).getValue().x).toEqual(10)
  expect(loop.size()).toBe(3)
})

test('keyed reordering does not rebuild items (builder call count)', () => {
  const Item = ({ value }) => h('B', null, value.x)
  let built = 0
  const builder = opts => {
    built++
    return LoopItem(opts)
  }
  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, builder, p: 'loop' }), 'test'))
  const loop = scope.loop

  loop.setValue([keyed('a', 1), keyed('b', 2), keyed('c', 3)])
  expect(built).toBe(3)

  loop.setValue([keyed('b', 2), keyed('c', 3), keyed('a', 1)])
  expect(div.innerHTML).toEqual('<b>2</b><b>3</b><b>1</b>test')
  expect(built).toBe(3) // moved, never rebuilt
})

test('insert at the front keeps the existing instances and builds only the new one', () => {
  const Item = ({ value }) => h('B', null, value.x)
  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  const loop = scope.loop

  loop.setValue([keyed('a', 1), keyed('b', 2)])
  const [A, B] = loop.getItems()

  loop.setValue([keyed('n', 9), keyed('a', 1), keyed('b', 2)])

  expect(div.innerHTML).toEqual('<b>9</b><b>1</b><b>2</b>test')
  const N = loop.getItem(0)
  expect(loop.getItem(1)).toBe(A)
  expect(loop.getItem(2)).toBe(B)
  expect(loop.getItemByKey('n')).toBe(N)
  expect(N).not.toBe(A)
  expect(loop.size()).toBe(3)
  expect(loop.allItems.length).toBe(3) // nothing was parked: the list only grew
})

test('remove from the middle keeps sibling order and parks the item for keyed reuse', () => {
  const Item = ({ value }) => h('B', null, value.x)
  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  const loop = scope.loop

  loop.setValue([keyed('a', 1), keyed('b', 2), keyed('c', 3)])
  const [A, B, C] = loop.getItems()
  B.mutationMark = 'B' // per-item state that a rebuilt item would lose
  const bNode = B.el

  loop.setValue([keyed('a', 1), keyed('c', 3)])

  expect(div.innerHTML).toEqual('<b>1</b><b>3</b>test')
  expect(loop.size()).toBe(2)
  expect(loop.getItem(0)).toBe(A)
  expect(loop.getItem(1)).toBe(C)
  // parked for reuse, NOT disposed (P2-1 contract): still in allItems, detached from the DOM
  expect(loop.allItems.length).toBe(3)
  expect(loop.allItems).toContain(B)
  expect(bNode.parentNode).toBe(null)
  expect(loop.getItemByKey('b')).toBe(B)

  // re-adding the key reuses the very same instance and its state
  loop.setValue([keyed('a', 1), keyed('b', 22), keyed('c', 3)])
  expect(div.innerHTML).toEqual('<b>1</b><b>22</b><b>3</b>test')
  expect(loop.getItem(1)).toBe(B)
  expect(loop.getItem(1).el).toBe(bNode)
  expect(loop.getItem(1).mutationMark).toBe('B')
})

test('keyed component instances keep their internal state across a reorder', () => {
  class Row extends Jsx6 {
    clicks = 0
    tpl() {
      return h('B', null, this.$v.x)
    }
  }

  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Row, p: 'loop' }), 'test'))
  const loop = scope.loop

  loop.setValue([keyed('a', 1), keyed('b', 2), keyed('c', 3)])
  expect(div.innerHTML).toEqual('<b>1</b><b>2</b><b>3</b>test')

  const rows = loop.getItems()
  rows[1].clicks = 7
  const bNode = rows[1].el

  loop.setValue([keyed('c', 3), keyed('b', 2), keyed('a', 1)])

  expect(div.innerHTML).toEqual('<b>3</b><b>2</b><b>1</b>test')
  expect(loop.getItem(1)).toBe(rows[1])
  expect(loop.getItem(1).clicks).toBe(7)
  expect(loop.getItem(1).el).toBe(bNode)
  expect(loop.getItem(1).getValue().x).toEqual(2)
  expect(loop.getItem(0).clicks).toBe(0)
  expect(loop.getItem(2).clicks).toBe(0)
})

test('a key written in the item template participates in matching', () => {
  // the idiomatic `key={value.id}`: insertAttr stores the signal in `loopKey` and mirrors its
  // value into the `key` attribute; Loop resolves it to the key the user wrote
  const Item = ({ value }) => h('B', { key: value.id }, value.x)
  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  const loop = scope.loop

  const rows = [
    { id: 'a', x: 1 },
    { id: 'b', x: 2 },
  ]
  loop.setValue(rows)
  const [A, B] = loop.getItems()
  expect(A.el.loopKey).toBeDefined() // what insertAttr stored for `key`
  expect(A.el.getAttribute('key')).toEqual('a')
  expect(loop.getItemByKey('a')).toBe(A)

  // the very same datum objects in a new order: the key learned at build time drives the move
  // (`insertAttr` also mirrors the signal into a `key` attribute, hence it shows in innerHTML)
  loop.setValue([rows[1], rows[0]])
  expect(div.innerHTML).toEqual('<b key="b">2</b><b key="a">1</b>test')
  expect(loop.getItem(0)).toBe(B)
  expect(loop.getItem(1)).toBe(A)
  expect(loop.getItem(0).getValue().x).toEqual(2)
})

test('unkeyed data keeps the index-based reuse (unchanged behaviour)', () => {
  const Item = ({ value }) => h('B', null, value.x)
  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  const loop = scope.loop

  loop.setValue([{ x: 1 }, { x: 2 }])
  const [A, B] = loop.getItems()
  const aNode = A.el
  const bNode = B.el

  // fresh objects without a key: the item at each index is updated in place, exactly as before
  loop.setValue([{ x: 2 }, { x: 1 }])
  expect(div.innerHTML).toEqual('<b>2</b><b>1</b>test')
  expect(loop.getItem(0)).toBe(A)
  expect(loop.getItem(1)).toBe(B)
  expect(loop.getItem(0).el).toBe(aNode)
  expect(loop.getItem(1).el).toBe(bNode)
  expect(loop.size()).toBe(2)
  expect(loop.keyMap.size).toBe(0)
})

test('keyed and unkeyed entries coexist: only the keyed one is matched by key', () => {
  const Item = ({ value }) => h('B', null, value.x)
  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  const loop = scope.loop

  loop.setValue([keyed('a', 1), { x: 2 }])
  const [A, B] = loop.getItems()
  const aNode = A.el

  // the keyed entry claims its instance even though it moved to the last position; the unkeyed
  // entry takes the slot that is left by the index fallback
  loop.setValue([{ x: 9 }, keyed('a', 1)])
  expect(div.innerHTML).toEqual('<b>9</b><b>1</b>test')
  expect(loop.getItem(0)).toBe(B)
  expect(loop.getItem(1)).toBe(A)
  expect(loop.getItem(1).el).toBe(aNode)
  expect(loop.getItemByKey('a')).toBe(A)
})

test('duplicate keys: the first occurrence owns the key, the extra one is index-reconciled', () => {
  const Item = ({ value }) => h('B', null, value.x)
  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  const loop = scope.loop

  loop.setValue([keyed('dup', 1), keyed('dup', 2)])

  expect(div.innerHTML).toEqual('<b>1</b><b>2</b>test')
  const [A, B] = loop.getItems()
  expect(loop.getItemByKey('dup')).toBe(A)
  expect(B).not.toBe(A)

  // a reorder of the two duplicates does not corrupt the list: the first entry keeps the key
  loop.setValue([keyed('dup', 2), keyed('dup', 1)])
  expect(div.innerHTML).toEqual('<b>2</b><b>1</b>test')
  expect(loop.getItemByKey('dup')).toBe(A)
  expect(loop.getItem(0)).toBe(A)
  expect(loop.getItem(1)).toBe(B)
})

test('a parked keyed item keeps its bindings, and dispose() clears the key map', () => {
  const Item = ({ value }) => h('B', null, value.x)
  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  const loop = scope.loop

  loop.setValue([keyed('a', 1), keyed('b', 2)])
  const B = loop.getItem(1)

  loop.setValue([keyed('a', 1)]) // 'b' is parked: hidden for reuse, NOT disposed (P2-1)
  expect(loop.allItems.length).toBe(2)
  expect(loop.getItemByKey('b')).toBe(B)
  B.setValue({ $key: 'b', x: 99 }) // the parked item's bindings are still live
  expect(B.el.textContent).toEqual('99')

  loop.dispose()
  expect(loop.keyMap.size).toBe(0)
  expect(loop.allItems).toEqual([])
  expect(loop.getItemByKey('b')).toBeUndefined()
})

test('splice re-claims a parked keyed item instead of the last reusable one', () => {
  const Item = ({ value }) => h('B', null, value.x)
  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  const loop = scope.loop

  loop.setValue([keyed('a', 1), keyed('b', 2), keyed('c', 3)])
  const B = loop.getItem(1)
  B.mutationMark = 'B'

  loop.splice(1, 1) // remove 'b' from the middle: parked, still reusable
  expect(div.innerHTML).toEqual('<b>1</b><b>3</b>test')
  expect(loop.allItems.length).toBe(3)

  loop.splice(1, 0, keyed('b', 20)) // re-add key 'b' in the middle
  expect(div.innerHTML).toEqual('<b>1</b><b>20</b><b>3</b>test')
  expect(loop.getItem(1)).toBe(B)
  expect(loop.getItem(1).mutationMark).toBe('B')
  expect(loop.getItemByKey('b')).toBe(B)
})

test('splice(index, deleteCount, keyedData) replaces the entry in place', () => {
  const Item = ({ value }) => h('B', null, value.x)
  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  const loop = scope.loop

  loop.setValue([keyed('a', 1), keyed('b', 2), keyed('c', 3)])
  loop.setValue([keyed('a', 1), keyed('c', 3)]) // 'b' is parked, still keyed
  const B = loop.getItemByKey('b')
  expect(B).toBeDefined()

  // replace entry 0 with key 'b': the parked instance is claimed and takes the slot in place
  loop.splice(0, 1, keyed('b', 20))
  expect(div.innerHTML).toEqual('<b>20</b><b>3</b>test')
  expect(loop.size()).toBe(2)
  expect(loop.getItem(0)).toBe(B)
  expect(loop.getItem(1)).toBe(loop.getItemByKey('c'))
  expect(loop.getItemByKey('b')).toBe(B)
})

test('push and pop keep a keyed item parked and reusable by key', () => {
  const Item = ({ value }) => h('B', null, value.x)
  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  const loop = scope.loop

  loop.setValue([keyed('a', 1), keyed('b', 2)])
  const B = loop.getItem(1)

  expect(loop.pop()).toBe(B)
  expect(div.innerHTML).toEqual('<b>1</b>test')
  expect(loop.allItems.length).toBe(2) // parked, not disposed
  expect(loop.getItemByKey('b')).toBe(B)

  loop.push(keyed('b', 22))
  expect(div.innerHTML).toEqual('<b>1</b><b>22</b>test')
  expect(loop.getItem(1)).toBe(B)
  expect(loop.size()).toBe(2)
})

test('disposeItem releases the key so the entry is never reused by key', () => {
  const Item = ({ value }) => h('B', null, value.x)
  const scope = {}
  const div = domWithScope(scope, h => h('DIV', null, h(Loop, { item: Item, p: 'loop' }), 'test'))
  const loop = scope.loop

  loop.setValue([keyed('a', 1), keyed('b', 2)])
  const B = loop.getItem(1)
  expect(loop.disposeItem(B)).toBe(B)
  expect(loop.getItemByKey('b')).toBeUndefined()
  expect(div.innerHTML).toEqual('<b>1</b>test')

  loop.setValue([keyed('a', 1), keyed('b', 2)])
  expect(div.innerHTML).toEqual('<b>1</b><b>2</b>test')
  expect(loop.getItem(1)).not.toBe(B) // a fresh item, the disposed one is gone for good
})
