/**
 * Tests for the part of `Loop2` that a scroll host drives — windowing (`setWindow`/`startIndex`) and
 * the per-frame hooks a host needs (`onPark`/`onRestore`, `onDuplicateKey`, `onBeforeMove`/
 * `onAfterMove`), plus the structural guarantee that a throwing user callback cannot orphan a node.
 *
 * These are the behaviours `plan/loop2-plan.md` §5 P5 introduces to align `@jsx6/loop2` with
 * `@jsx6/virtual-scroll`. The cross-package contract itself — one key function passed to both — is
 * pinned in `test/virtual-scroll.integration.test.js`, where virtual-scroll is a dev-dependency
 * only: nothing in `src/` may import it.
 *
 * Style matches `Loop2.test.js`: happy-dom registered globally, items built with the `h` factory.
 */
import { afterAll, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { domWithScope, h } from '@jsx6/jsx6'

import { Loop2, Loop2Item } from './Loop2.js'

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

/** The keyed fixture the windowing tests scroll through. */
const makeRows = n => Array.from({ length: n }, (_, i) => ({ id: i, x: i }))

/** The value an item currently renders — `Loop2Item` hands a *signal* to `getValue()`. */
const valueOf = item => {
  const value = item.getValue()
  return typeof value === 'function' ? value() : value
}

/** The rows a list of items currently shows. */
const rowsOf = items => items.map(item => valueOf(item).id)

/** `<div>` children that are loop rows (the loop's anchor and the trailing text are not). */
const rowNodes = div => [...div.childNodes].filter(node => node.nodeType === 1)

// ---------------------------------------------------------------------------------------------
// windowing: absolute indices
// ---------------------------------------------------------------------------------------------

test('a detached loop can be driven with setWindow and renders the slice in order', () => {
  const loop = new Loop2({ item: Item, keyBy: row => row.id, maxPooled: 6 })
  loop.setWindow(
    [
      { id: 2, x: 2 },
      { id: 3, x: 3 },
    ],
    2,
  )

  expect(loop.size()).toEqual(2)
  expect(loop.getWindow()).toEqual([2, 4])
  const div = document.createElement('DIV')
  div.appendChild(loop.el)
  loop.refresh()
  expect(div.innerHTML).toEqual('<b>2</b><b>3</b>')
})

test('keyBy, onBuild, attr.i, $i and the node stamps all report the absolute index', () => {
  const seen = []
  const keys = []
  const buildIndices = []
  // a template that reads the index it was built with, the way a host's row renderer would
  const Indexed = ({ value, attr }) => {
    buildIndices.push([value().id, attr.i])
    return h('B', null, value().x)
  }
  const { div, loop } = mount({
    item: Indexed,
    keyBy: (row, i) => {
      keys.push(i)
      return row.id
    },
    onBuild: (item, data, i) => seen.push([data.id, i]),
  })

  loop.setWindow(makeRows(4).slice(1, 3), 1)
  expect(div.innerHTML).toEqual('<b>1</b><b>2</b>test')
  expect(keys).toEqual([1, 2])
  expect(seen).toEqual([
    [1, 1],
    [2, 2],
  ])
  expect(buildIndices).toEqual([
    [1, 1],
    [2, 2],
  ])
  expect(loop.getWindow()).toEqual([1, 3])
  expect(loop.absIndex(0)).toEqual(1)
  expect(loop.absIndex(1)).toEqual(2)
  // the item's node carries the index it is rendered at, and so does the loop's own lookup
  expect(loop.getItem(0).el.$i).toEqual(1)
  expect(loop.getItem(1).el.$i).toEqual(2)
  expect(loop.getItem(0).el.__loop2Index).toEqual(1)
  expect(loop.getItem(1).el.loopIndex).toEqual(1)
  // `getItemIndex` stays relative — the addressing the mutation API asks for
  expect(loop.getItemIndex(loop.getItem(1))).toEqual(1)
  expect(loop.getAbsoluteIndex(loop.getItem(1))).toEqual(2)
  expect(loop.getAbsoluteIndex(loop.getItem(1).el)).toEqual(2)
  expect(loop.getAbsoluteIndex(() => loop.getItem(1))).toEqual(2)
})

test('a reused item is renamed to the index it is rendered at', () => {
  const rows = makeRows(20)
  const { loop } = mount({ keyBy: row => row.id })

  loop.setWindow(rows.slice(0, 3), 0)
  const [A] = loop.getItems()
  expect(A.el.$i).toEqual(0)

  // a reorder inside the window: `A` moves from 0 to 2 without being rebuilt
  loop.setWindow([rows[2], rows[1], rows[0]], 0)
  expect(loop.getItem(2)).toBe(A)
  expect(A.el.$i).toEqual(2)
  expect(A.el.__loop2Index).toEqual(2)
  expect(loop.getAbsoluteIndex(A)).toEqual(2)
})

test('windowing 10 000 rows never exceeds a window plus its pool, and rebuilds only new keys', () => {
  const rows = makeRows(10_000)
  const built = []
  const { loop } = mount({
    keyBy: row => row.id,
    onBuild: (item, data) => built.push(data.id),
    maxPooled: 5,
  })
  /** the rows each distinct window start showed the first time it was rendered */
  const firstRows = new Map()

  for (const top of [0, 100, 2000, 9995, 2000, 0]) {
    loop.setWindow(rows.slice(top, top + 5), top)
    // the invariant that makes windowing safe: what the loop holds is the window plus its pool
    expect(loop.count).toEqual(5)
    expect(loop.allItems.length).toBeLessThanOrEqual(10)
    const shown = rowsOf(loop.items)
    expect(shown).toEqual([0, 1, 2, 3, 4].map(k => top + k))
    if (firstRows.has(top)) expect(shown).toEqual(firstRows.get(top))
    else firstRows.set(top, shown)
  }

  expect(loop.getWindow()).toEqual([0, 5])
  // five items exist for the whole journey: each window hands its rows to the next one, so a window
  // of 5 costs 5 DOM nodes no matter how far the list scrolls
  expect(built.length).toEqual(5)
  expect([...new Set(built)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
})

test('a shifted window keeps its item instances and gets them back on the way home', () => {
  const rows = makeRows(100)
  const built = []
  const { loop } = mount({
    keyBy: row => row.id,
    onBuild: (item, data) => built.push(data.id),
    maxPooled: 4,
  })

  loop.setWindow(rows.slice(0, 4), 0)
  const first = loop.items.slice()
  expect(rowsOf(first)).toEqual([0, 1, 2, 3])

  // a scroll renumbers the items it keeps — the instance that showed row 0 now shows row 10 — and
  // costs nothing: the pool is exactly the window, so every row of the new window reuses an item
  loop.setWindow(rows.slice(10, 14), 10)
  expect(rowsOf(loop.items)).toEqual([10, 11, 12, 13])
  expect(loop.getItem(0).el.$i).toEqual(10)
  expect(built.length).toEqual(4)

  // scrolling back restores each position to the very instance that held it before
  loop.setWindow(rows.slice(0, 4), 0)
  expect(rowsOf(loop.items)).toEqual([0, 1, 2, 3])
  expect(loop.items.map((item, k) => item === first[k])).toEqual([true, true, true, true])
  expect(loop.getItem(0).el.$i).toEqual(0)
  expect(built.length).toEqual(4)
})

test('a one-row scroll of a full pool costs no build and at most one DOM move', () => {
  const rows = makeRows(100)
  const built = []
  const { div, loop } = mount({
    keyBy: row => row.id,
    onBuild: (item, data) => built.push(data.id),
    maxPooled: 5,
  })
  loop.setWindow(rows.slice(0, 5), 0)
  expect(built.length).toEqual(5)

  const movesBefore = loop.domMoves
  loop.setWindow(rows.slice(1, 6), 1)
  expect(rowsOf(loop.items)).toEqual([1, 2, 3, 4, 5])
  expect(div.innerHTML).toEqual('<b>1</b><b>2</b><b>3</b><b>4</b><b>5</b>test')
  // the row that left the window becomes the row that entered it: the node count never changes
  expect(built.length).toEqual(5)
  expect(loop.allItems.length).toEqual(5)
  expect(loop.domMoves - movesBefore).toEqual(1)
})

test('a fragment item is stamped and addressed per node, absolutely', () => {
  const Frag = ({ value }) => [h('B', null, value.x), h('I', null, value.id)]
  const { div, loop } = mount({ item: Frag, keyBy: row => row.id })
  loop.setWindow(makeRows(3).slice(1), 1)
  expect(div.innerHTML).toEqual('<b>1</b><i>1</i><b>2</b><i>2</i>test')
  const second = loop.getItem(1)
  expect(second.el[1].__loop2Index).toEqual(2)
  expect(second.el[0].$i).toEqual(2)
  expect(loop.getAbsoluteIndex(second.el[1])).toEqual(2)
})

test('setWindow validates its arguments and is chainable', () => {
  const { loop } = mount()
  expect(loop.setWindow([])).toBe(loop)
  expect(() => loop.setWindow('nope')).toThrow(TypeError)
  expect(() => loop.setWindow([], -1)).toThrow(RangeError)
  expect(() => loop.setWindow([], 1.5)).toThrow(RangeError)
})

test('setValue returns the loop to a full list, and the mutation API refuses a window', () => {
  const { loop } = mount({ keyBy: row => row.id })
  loop.setWindow(
    [
      { id: 1, x: 1 },
      { id: 2, x: 2 },
    ],
    400,
  )
  expect(loop.getWindow()).toEqual([400, 402])

  // mutating a window would edit the slice the host owns: it fails loudly instead
  expect(() => loop.push({ id: 3, x: 3 })).toThrow(/window/)
  expect(() => loop.pop()).toThrow(/window/)
  expect(() => loop.splice(0, 1)).toThrow(/window/)
  expect(() => loop.moveItem(0, 1)).toThrow(/window/)
  expect(() => loop.setItem({ id: 9, x: 9 }, 0)).toThrow(/window/)

  // a full replacement resets the origin, so the two entry points cannot disagree
  loop.setValue([
    { id: 1, x: 1 },
    { id: 2, x: 2 },
  ])
  expect(loop.getWindow()).toEqual([0, 2])
  expect(loop.getItem(0).el.$i).toEqual(0)
  loop.push({ id: 3, x: 3 })
  expect(loop.size()).toEqual(3)
})

// ---------------------------------------------------------------------------------------------
// per-frame hooks
// ---------------------------------------------------------------------------------------------

test('onRestore reports the items that become visible, with the row each shows', () => {
  const restored = []
  const rows = makeRows(10)
  const { loop } = mount({
    keyBy: row => row.id,
    // the hook receives the item *and* the row it shows, because a pass may have renamed the item
    onRestore: (item, value) => restored.push([value.id, item === loop.items[0]]),
  })

  loop.setWindow(rows.slice(0, 3), 0)
  expect(restored).toEqual([
    [0, true],
    [1, false],
    [2, false],
  ])

  // a full scroll reuses the three items, so no item enters the visible range: the row under each
  // item changes (visible through `getValue`), which is not what these hooks report
  loop.setWindow(rows.slice(1, 4), 1)
  expect(rowsOf(loop.items)).toEqual([1, 2, 3])
  expect(restored.length).toEqual(3)
})

test('onPark reports the items that leave the visible range, with the row each showed', () => {
  const parked = []
  const rows = makeRows(10)
  const { loop } = mount({
    keyBy: row => row.id,
    onPark: (item, value) => parked.push(value.id),
    maxPooled: 0, // keep nothing: a shrinking list really does park
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

  // `pop()` parks the item it removes (row 0 is *reused*, not rebuilt, so it stays item 0)
  loop.setValue([
    { id: 0, x: 0 },
    { id: 1, x: 1 },
  ])
  const popped = loop.pop()
  expect(valueOf(popped).id).toEqual(1)
  expect(parked).toEqual([1, 2, 1])
})

test('onPark reports the rows the pool keeps — a row taken over in the same pass is not parked', () => {
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

  // a scroll reuses the evicted row for the entering one, so it is never "parked" in the host's eyes
  const rows = makeRows(20)
  parked.length = 0
  loop.setWindow(rows.slice(0, 3), 0)
  loop.setWindow(rows.slice(1, 4), 1)
  expect(parked).toEqual([])

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

test('a duplicate key is reported once per reconciliation, first occurrence wins', () => {
  const reports = []
  const { loop } = mount({
    keyBy: row => row.id,
    maxPooled: 8,
    onDuplicateKey: (key, data, index, first) => reports.push([key, data.x, index, first]),
  })
  const window = () => [
    { id: 'a', x: 1 },
    { id: 'b', x: 2 },
    { id: 'a', x: 3 },
  ]

  loop.setWindow(window(), 0)
  expect(reports).toEqual([['a', 3, 2, 0]])
  // the first occurrence owns the key, the later entry gets its own (unkeyed) item
  expect(loop.getItemByKey('a')).toBe(loop.getItem(0))
  expect(loop.getKey(loop.getItem(2))).toBeUndefined()
  expect(valueOf(loop.getItem(2)).x).toEqual(3)

  // one report per reconciliation, never per row: a repeated window reports the key once more
  loop.setWindow(window(), 0)
  expect(reports).toEqual([
    ['a', 3, 2, 0],
    ['a', 3, 2, 0],
  ])

  // the owner keeps its absolute index: a new key never claims the item of a key it does not own
  loop.setWindow(
    [
      { id: 'a', x: 1 },
      { id: 'b', x: 2 },
      { id: 'a', x: 3 },
    ],
    100,
  )
  expect(reports[2]).toEqual(['a', 3, 102, 100])

  // once the duplicate is gone, a later repeat is reported again
  loop.setWindow([{ id: 'a', x: 1 }], 0)
  loop.setWindow(
    [
      { id: 'a', x: 5 },
      { id: 'a', x: 6 },
    ],
    0,
  )
  expect(reports[3]).toEqual(['a', 6, 1, 0])
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
// atomicity: a throwing user callback cannot orphan a node or lose an item
// ---------------------------------------------------------------------------------------------

test('a throwing builder leaves no orphaned node and a usable loop', () => {
  let fail = false
  const builder = opts => {
    if (fail && opts.i === 2) throw new Error('builder failed')
    return Loop2Item(opts)
  }
  const { div, loop } = mount({ builder, keyBy: row => row.id })

  loop.setValue(makeRows(2))
  expect(div.innerHTML).toEqual('<b>0</b><b>1</b>test')
  expect(rowNodes(div).length).toEqual(2)
  const visible = loop.getItems()

  fail = true
  expect(() => loop.setValue(makeRows(3))).toThrow('builder failed')
  fail = false

  // the throw left no third node behind: the DOM is exactly the previous two rows
  expect(div.innerHTML).toEqual('<b>0</b><b>1</b>test')
  expect(rowNodes(div).length).toEqual(2)
  // every item the loop knows is visible or parked, its key map still answers, and it still works
  expect(loop.count).toEqual(2)
  expect(loop.getItems()).toEqual(visible)
  expect(loop.allItems.length).toBeGreaterThanOrEqual(loop.count)
  expect(loop.getItemByKey(1)).toBe(visible[1])
  loop.setValue(makeRows(3))
  expect(div.innerHTML).toEqual('<b>0</b><b>1</b><b>2</b>test')
  expect(loop.count).toEqual(3)
})

test('a throwing builder in a windowed pass keeps the window and the key map intact', () => {
  const rows = makeRows(20)
  let fail = false
  const built = []
  const builder = opts => {
    built.push(opts.i)
    if (fail && opts.i === 15) throw new Error('windowed builder failed')
    return Loop2Item(opts)
  }
  const { loop } = mount({ builder, keyBy: row => row.id, maxPooled: 4 })
  loop.setWindow(rows.slice(0, 4), 0)
  expect(rowsOf(loop.items)).toEqual([0, 1, 2, 3])

  // the loop owns four items, so a six-row window recycles them all and has to build two more —
  // and the second build throws. The pass is abandoned as a whole.
  fail = true
  built.length = 0
  expect(() => loop.setWindow(rows.slice(10, 16), 10)).toThrow('windowed builder failed')
  fail = false
  expect(built).toEqual([14, 15])

  // so the loop still renders the previous window and the keys that window owns
  expect(loop.getWindow()).toEqual([0, 4])
  expect(rowsOf(loop.items)).toEqual([0, 1, 2, 3])
  expect(loop.getItemByKey(1)).toBe(loop.items[1])
  expect(loop.allItems.length).toBeGreaterThanOrEqual(loop.count)

  // and the window renders normally once the fault is gone
  loop.setWindow(rows.slice(10, 16), 10)
  expect(rowsOf(loop.items)).toEqual([10, 11, 12, 13, 14, 15])
  expect(loop.getWindow()).toEqual([10, 16])
})

test('a builder that returns nothing is reported instead of rendering garbage', () => {
  const { loop } = mount({ builder: () => undefined })
  expect(() => loop.setValue([{ x: 1 }])).toThrow(TypeError)
  expect(loop.count).toEqual(0)
  expect(loop.allItems.length).toEqual(0)
})
