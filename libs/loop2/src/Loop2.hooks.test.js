/**
 * Tests for the **lifecycle hooks** of `Loop2`: `onPark`/`onRestore` (the reuse pool), `onDuplicateKey`
 * (once per key per reconciliation) and `onBeforeMove`/`onAfterMove` (the DOM ordering, i.e. the FLIP
 * hook), plus the builder validation.
 *
 * These are the behaviours an app uses to release per-row resources and to animate rows, and they are
 * driven by `setValue`/`pop` alone: `Loop2` renders all the data it is given and has no windowing.
 *
 * Style matches `Loop2.test.js`: happy-dom registered globally, items built with the `h` factory.
 */
import { afterAll, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { domWithScope, h } from '@jsx6/jsx6'

import { Loop2 } from './Loop2.js'

GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

const Item = ({ value }) => h('B', null, value.x)

/** Build a loop inside a container, through the jsx runtime (`p` assigns it to the scope). */
const mount = (opts = {}) => {
  const scope = {}
  const div = domWithScope(scope, hFn =>
    hFn('DIV', null, hFn(Loop2, { item: Item, p: 'loop', ...opts }), 'test'),
  )
  return { div, loop: scope.loop }
}

/** The value an item currently renders — `Loop2Item` hands a *signal* to `getValue()`. */
const valueOf = item => {
  const value = item.getValue()
  return typeof value === 'function' ? value() : value
}

/** The rows a list of items currently shows. */
const rowsOf = items => items.map(item => valueOf(item).id)

// ---------------------------------------------------------------------------------------------
// onPark / onRestore: the reuse pool
// ---------------------------------------------------------------------------------------------

test('onRestore reports the items that become visible, with the row each shows', () => {
  const restored = []
  const { loop } = mount({
    keyBy: row => row.id,
    // the hook receives the item *and* the row it shows, because a pass may have renamed the item
    onRestore: (item, value) => restored.push(value.id),
  })

  loop.setValue([
    { id: 0, x: 0 },
    { id: 1, x: 1 },
    { id: 2, x: 2 },
  ])
  expect(restored).toEqual([0, 1, 2])

  // a shorter list parks rows 1 and 2: nothing enters the visible set
  restored.length = 0
  loop.setValue([{ id: 0, x: 0 }])
  expect(restored).toEqual([])

  // growing back hands the parked instances their rows again
  restored.length = 0
  loop.setValue([
    { id: 0, x: 0 },
    { id: 1, x: 1 },
    { id: 2, x: 2 },
  ])
  expect(restored).toEqual([1, 2])
  expect(rowsOf(loop.items)).toEqual([0, 1, 2])
})

test('onPark reports the items that leave the visible set, with the row each showed', () => {
  const parked = []
  const { loop } = mount({
    keyBy: row => row.id,
    onPark: (item, value) => parked.push(value.id),
  })

  loop.setValue([
    { id: 0, x: 0 },
    { id: 1, x: 1 },
    { id: 2, x: 2 },
  ])
  expect(parked).toEqual([])

  // shrinking keeps row 0 and parks rows 1 and 2 — the hook gets the rows they *were* showing, even
  // though `setValue` renamed those items before the hook ran
  loop.setValue([{ id: 0, x: 0 }])
  expect(parked).toEqual([1, 2])
  expect(loop.count).toEqual(1)

  // `pop()` parks the item it removes
  loop.setValue([
    { id: 0, x: 0 },
    { id: 1, x: 1 },
  ])
  parked.length = 0
  const popped = loop.pop()
  expect(valueOf(popped).id).toEqual(1)
  expect(parked).toEqual([1])
})

test('onPark reports the rows the pool keeps — a row renamed in place is not parked', () => {
  const parked = []
  const { loop } = mount({ keyBy: row => row.id, onPark: item => parked.push(valueOf(item).id) })

  loop.setValue([
    { id: 0, x: 0 },
    { id: 1, x: 1 },
    { id: 2, x: 2 },
  ])
  expect(parked).toEqual([])

  // shrinking keeps row 0 and parks rows 1 and 2 (they are not taken over by anything)
  loop.setValue([{ id: 0, x: 0 }])
  expect(parked).toEqual([1, 2])

  // a new key takes over the item freed at its index in the same pass: that item never leaves the
  // visible set, so it is reported as neither parked nor restored
  parked.length = 0
  loop.setValue([
    { id: 0, x: 0 },
    { id: 9, x: 9 },
    { id: 2, x: 2 },
  ])
  expect(parked).toEqual([])
  expect(rowsOf(loop.items)).toEqual([0, 9, 2])
})

test('a throwing onPark does not stop the other parks, and the first error surfaces', () => {
  const parked = []
  const { loop } = mount({
    item: Item,
    keyBy: row => row.id,
    onPark: item => {
      parked.push(valueOf(item).id)
      if (valueOf(item).id === 1) throw new Error('park hook failed')
    },
  })
  loop.setValue([
    { id: 0, x: 0 },
    { id: 1, x: 1 },
    { id: 2, x: 2 },
  ])
  expect(() => loop.setValue([{ id: 9, x: 9 }])).toThrow('park hook failed')
  // every leaving row was reported before the error propagated
  expect(parked).toEqual([1, 2])
  // and the loop is consistent afterwards: one visible row, the rest parked
  expect(loop.count).toEqual(1)
  expect(loop.allItems.length).toEqual(3)
})

// ---------------------------------------------------------------------------------------------
// onDuplicateKey, onBeforeMove / onAfterMove
// ---------------------------------------------------------------------------------------------

test('a duplicate key is reported once per reconciliation, first occurrence wins', () => {
  const reports = []
  const { loop } = mount({
    keyBy: row => row.id,
    maxPooled: 8,
    onDuplicateKey: (key, data, index, first) => reports.push([key, data.x, index, first]),
  })
  const rows = () => [
    { id: 'a', x: 1 },
    { id: 'b', x: 2 },
    { id: 'a', x: 3 },
  ]

  loop.setValue(rows())
  expect(reports).toEqual([['a', 3, 2, 0]])
  // the first occurrence owns the key, the later entry gets its own (unkeyed) item
  expect(loop.getItemByKey('a')).toBe(loop.getItem(0))
  expect(loop.getKey(loop.getItem(2))).toBeUndefined()
  expect(valueOf(loop.getItem(2)).x).toEqual(3)

  // one report per reconciliation, never per row: a repeated list reports the key once more
  loop.setValue(rows())
  expect(reports).toEqual([
    ['a', 3, 2, 0],
    ['a', 3, 2, 0],
  ])

  // once the duplicate is gone, a later repeat is reported again
  loop.setValue([{ id: 'a', x: 1 }])
  loop.setValue([
    { id: 'a', x: 5 },
    { id: 'a', x: 6 },
  ])
  expect(reports[2]).toEqual(['a', 6, 1, 0])
})

test('onBeforeMove/onAfterMove fire once per moved item, and not at all when nothing moves', () => {
  const before = []
  const after = []
  const rows = [
    { id: 'a', x: 1 },
    { id: 'b', x: 2 },
    { id: 'c', x: 3 },
  ]
  const { loop } = mount({
    keyBy: row => row.id,
    onBeforeMove: item => before.push(valueOf(item).id),
    onAfterMove: item => after.push(valueOf(item).id),
  })

  loop.setValue(rows)
  before.length = 0
  after.length = 0

  loop.setValue(rows) // same order: not a single DOM mutation
  expect(before).toEqual([])
  expect(after).toEqual([])
  expect(loop.domMoves).toEqual(0)

  // [a,b,c] → [b,c,a] is one move: only `a` changed place
  loop.setValue([rows[1], rows[2], rows[0]])
  expect(before).toEqual(['a'])
  expect(after).toEqual(['a'])
  expect(loop.domMoves).toEqual(1)

  // [b,c,a] → [a,c,b] moves `b` (before `c`) and `a` (back to the front)
  loop.setValue([rows[0], rows[2], rows[1]])
  expect(before).toEqual(['a', 'b', 'c'])
  expect(after).toEqual(['a', 'b', 'c'])
  expect(loop.domMoves).toEqual(3)
})

// ---------------------------------------------------------------------------------------------
// builder validation
// ---------------------------------------------------------------------------------------------

test('a builder that returns nothing is reported instead of rendering garbage', () => {
  const { loop } = mount({ builder: () => undefined })
  expect(() => loop.setValue([{ x: 1 }])).toThrow(TypeError)
  expect(loop.count).toEqual(0)
  expect(loop.allItems.length).toEqual(0)
})
