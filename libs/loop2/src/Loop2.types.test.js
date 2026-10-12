/**
 * Tests for the **type axis**: `typeBy` makes a row's slot depend on its type as well as its key, so a
 * list that mixes row kinds never lets one kind inherit another's item.
 *
 * The rule the tests pin down: only rows of the same type share reuse slots; a **falsy** type
 * (`undefined`, `null`, `''`, `0`) means untyped, every untyped row shares the one default slot, and a
 * loop without `typeBy` behaves exactly as it did before the option existed.
 *
 * Style matches `Loop2.test.js` (happy-dom globally registered, items built with `h`).
 */
import { afterAll, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { domWithScope, h } from '@jsx6/jsx6'

import { Loop2, Loop2Item } from './Loop2.js'

GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

const Item = ({ value }) => h('B', null, value.x)
const valueOf = item => {
  const value = item.getValue()
  return typeof value === 'function' ? value() : value
}
const rowsOf = items => items.map(item => valueOf(item).id)

const mount = (opts = {}) => {
  const scope = {}
  const div = domWithScope(scope, hFn =>
    hFn('DIV', null, hFn(Loop2, { item: Item, p: 'loop', ...opts }), 'test'),
  )
  return { div, loop: scope.loop }
}

/** rows with a kind: 'h' = header, 'r' = row (both are types), '' = untyped */
const kinds = () => [
  { id: 1, kind: 'h', x: 10 },
  { id: 2, kind: 'r', x: 20 },
  { id: 3, kind: 'h', x: 30 },
  { id: 4, kind: 'r', x: 40 },
]

test('a row never inherits the item of another type, even at the same index', () => {
  const { div, loop } = mount({ keyBy: r => r.id, typeBy: r => r.kind, maxPooled: 8 })
  loop.setValue(kinds())
  expect(div.innerHTML).toEqual('<b>10</b><b>20</b><b>30</b><b>40</b>test')
  const [H1, R2, H3, R4] = loop.getItems()
  expect(loop.typeOf(H1)).toEqual('h')
  expect(loop.typeOf(R2)).toEqual('r')

  // swap the kinds at the same positions: the *index fallback* must not hand a header's item to a row
  // (or vice versa). Each position keeps its own type, so the two "opposite" slots are built fresh.
  loop.setValue([
    { id: 11, kind: 'r', x: 11 },
    { id: 12, kind: 'h', x: 12 },
    { id: 13, kind: 'r', x: 13 },
    { id: 14, kind: 'h', x: 14 },
  ])
  expect(div.innerHTML).toEqual('<b>11</b><b>12</b><b>13</b><b>14</b>test')
  // a slot only ever goes to its own type — the invariant the option exists for. (An item that *is* of
  // the wanted type may be recycled by index, which is exactly what the loop still does; what must
  // never happen is a header rendering into an item built for a row.)
  for (const item of loop.getItems()) expect(loop.typeOf(item)).toEqual(valueOf(item).kind)
  expect(loop.typeOf(loop.getItem(0))).toEqual('r')
  expect(loop.typeOf(loop.getItem(1))).toEqual('h')
  expect(loop.typeOf(loop.getItem(2))).toEqual('r')
  expect(loop.typeOf(loop.getItem(3))).toEqual('h')
})

test('each type pools its own items, so a returning type gets its own instance back', () => {
  const { loop } = mount({ keyBy: r => r.id, typeBy: r => r.kind, maxPooled: 8 })
  loop.setValue(kinds())
  const [H1, R2] = loop.getItems()

  // drop the headers: the rows stay, the header items park in the 'h' pool
  loop.setValue([kinds()[1], kinds()[3]])
  expect(rowsOf(loop.items)).toEqual([2, 4])
  expect(loop.getItem(0)).toBe(R2)

  // a new header gets the parked header item (its own kind), not the row item next to it
  loop.setValue([kinds()[1], { id: 9, kind: 'h', x: 90 }])
  expect(loop.getItem(1)).toBe(H1)
  expect(valueOf(loop.getItem(1)).id).toEqual(9)
  expect(loop.typeOf(loop.getItem(1))).toEqual('h')
})

test('a falsy type is untyped: every such row shares the default slot', () => {
  const { loop } = mount({ keyBy: r => r.id, typeBy: r => r.kind, maxPooled: 8 })
  loop.setValue([
    { id: 1, kind: '', x: 1 },
    { id: 2, kind: null, x: 2 },
    { id: 3, kind: 0, x: 3 },
    { id: 4, kind: undefined, x: 4 },
  ])
  for (const item of loop.getItems()) expect(loop.typeOf(item)).toBeUndefined()

  // all four are the same (untyped) kind, so the first one may be recycled for a new untyped row
  const first = loop.getItem(0)
  loop.setValue([{ id: 9, kind: '', x: 9 }])
  expect(loop.getItem(0)).toBe(first)
  expect(valueOf(loop.getItem(0)).id).toEqual(9)
})

test('without typeBy every row is untyped and the behaviour is unchanged', () => {
  const { div, loop } = mount({ keyBy: r => r.id })
  loop.setValue(kinds())
  for (const item of loop.getItems()) expect(loop.typeOf(item)).toBeUndefined()
  const [H1] = loop.getItems()

  // the index fallback recycles across kinds exactly as before (this is `Loop`'s documented reuse)
  loop.setValue([{ id: 11, x: 11 }])
  expect(loop.getItem(0)).toBe(H1)
  expect(div.innerHTML).toEqual('<b>11</b>test')
})

test('typeBy receives the absolute index and the key can carry the type', () => {
  const seen = []
  const { loop } = mount({
    keyBy: r => r.id,
    typeBy: (r, i) => {
      seen.push(i)
      return r.kind
    },
  })
  loop.setWindow(kinds().slice(2), 2)
  expect(seen).toEqual([2, 3])
  expect(loop.typeOf(loop.getItem(0))).toEqual('h')

  // the key itself may declare the type (the object form of a JSX key), with no `typeBy` at all
  const other = mount({ keyBy: r => ({ id: r.id, type: r.kind }), maxPooled: 4 })
  other.loop.setValue(kinds())
  expect(other.loop.typeOf(other.loop.getItem(0))).toEqual('h')
  expect(other.loop.getKey(other.loop.getItem(1)).type).toEqual('r')
})

test('keepTypes releases the parked items of the types a window no longer renders', () => {
  const { loop } = mount({ keyBy: r => r.id, typeBy: r => r.kind, maxPooled: 8 })
  loop.setValue(kinds())
  loop.setValue([kinds()[0]]) // park the three others: one 'h' (item 3) and two 'r' (items 2 and 4)
  expect(loop.allItems.length).toEqual(4)

  expect(loop.keepTypes(['h'])).toEqual(2) // the two 'r' items are not coming back
  expect(loop.allItems.length).toEqual(2)
  expect(loop.typeOf(loop.getItem(0))).toEqual('h')

  // the kept type's pool still works
  loop.setValue([kinds()[0], kinds()[2]])
  expect(rowsOf(loop.items)).toEqual([1, 3])
})

test('the type flows to a custom builder and to onBuild', () => {
  const types = []
  const builder = opts => {
    types.push([opts.i, opts.type])
    return Loop2Item(opts)
  }
  const { loop } = mount({ builder, keyBy: r => r.id, typeBy: r => r.kind })
  loop.setValue(kinds())
  expect(types).toEqual([
    [0, 'h'],
    [1, 'r'],
    [2, 'h'],
    [3, 'r'],
  ])
})

test('a typed loop still gives a new key a fresh instance under strictKeys', () => {
  const { loop } = mount({
    keyBy: r => r.id,
    typeBy: r => r.kind,
    strictKeys: true,
    maxPooled: 8,
  })
  loop.setValue(kinds())
  const R2 = loop.getItem(1)

  // a new row arrives at the row position while the old row is dropped: strictKeys + type both say no
  loop.setValue([kinds()[0], { id: 99, kind: 'r', x: 99 }, kinds()[2], kinds()[3]])
  expect(loop.getItem(1)).not.toBe(R2)
  expect(loop.typeOf(loop.getItem(1))).toEqual('r')
  expect(valueOf(loop.getItem(1)).id).toEqual(99)
})
