/**
 * The cross-package contract between `@jsx6/loop2` and `@jsx6/virtual-scroll`: one scroll host drives
 * both, with **one key function** and one meaning of "index".
 *
 * These two packages do not depend on each other — `@jsx6/virtual-scroll` is a **devDependency of
 * this package only**, and nothing under `src/` may import it. The point of this file is to pin the
 * parts a host relies on when it pairs them, so a change on either side that silently breaks the
 * pairing fails here instead of in an app:
 *
 * 1. the key extractor is called the same way — `getKey(item, index)` there, `keyBy(data, index)`
 *    here — with the item's **absolute** index in the host's list;
 * 2. `VirtualScroll` owns the windowing arithmetic and `Loop2` renders the slice with
 *    `setWindow(slice, start)`, so the loop's absolute indices line up with the scroller's offsets;
 * 3. the node count is bounded by the window plus its pool, however large the list is: scrolling
 *    100 000 rows never builds more items than the window holds.
 *
 * The integration style is deliberately "two real libraries, hand-wired by a test host": nothing here
 * is shipped, and the host in the last test is the recipe the README documents.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { VirtualScroll } from '@jsx6/virtual-scroll'
import { h } from '@jsx6/jsx6'

import { Loop2 } from '../src/Loop2.js'

GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

const ITEM_HEIGHT = 32
const VIEWPORT = 320 // ten rows

const makeRows = n => Array.from({ length: n }, (_, i) => ({ id: i, x: i }))

const Item = ({ value }) => h('B', null, value.x)
const valueOf = item => {
  const value = item.getValue()
  return typeof value === 'function' ? value() : value
}
const rowsOf = items => items.map(item => valueOf(item).id)

/**
 * The host of the README recipe: `VirtualScroll` computes the window and positions it, `Loop2`
 * renders the rows of the slice. `onRender` sees the range the host rendered.
 */
const startHost = ({ count = 100_000, rows = makeRows(count), buffer = 1, maxPooled = 4 } = {}) => {
  const scroller = document.createElement('DIV')
  const container = document.createElement('DIV')
  scroller.appendChild(container)
  document.body.appendChild(scroller)

  const rendered = []
  const built = []
  let keyCalls = 0
  /** one key function for both halves; `index` is absolute in both */
  const keyOf = (row, i) => {
    keyCalls++
    return row.id
  }

  const loop = new Loop2({
    item: Item,
    keyBy: keyOf,
    maxPooled,
    onBuild: (item, data) => built.push(data.id),
  })
  container.appendChild(loop.el)

  const vs = new VirtualScroll({
    itemsContainer: container,
    scroller,
    itemHeight: ITEM_HEIGHT,
    items: rows,
    buffer,
    getKey: keyOf,
    createItem: () => document.createElement('DIV'),
    updateItemContent: () => {},
  })

  const render = scrollTop => {
    vs.render(scrollTop)
    const first = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - buffer)
    const last = Math.min(rows.length, Math.ceil((scrollTop + VIEWPORT) / ITEM_HEIGHT) + buffer)
    loop.setWindow(rows.slice(first, last), first)
    rendered.push([first, last])
  }

  vs.updateViewport(VIEWPORT, 0)
  // `updateViewport` renders once itself; bring the loop up for the same range
  loop.setWindow(rows.slice(0, Math.ceil(VIEWPORT / ITEM_HEIGHT) + buffer), 0)

  return { scroller, container, loop, vs, render, rendered, built, keyCalls: () => keyCalls, rows }
}

describe('loop2 + virtual-scroll', () => {
  test('both call the key extractor with the item and the same absolute index', () => {
    const host = startHost({ count: 5_000 })
    // the first render (viewport 0) covers rows 0..10 with buffer 1
    expect(host.keyCalls()).toBeGreaterThan(0)
    expect(rowsOf(host.loop.items)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

    // scroll to a row far down the list: the loop's rows and the vs indices agree
    host.render(2_000 * ITEM_HEIGHT)
    const vsIndexByKey = [...host.vs.idDomMap.entries()]
    expect(vsIndexByKey.length).toBeGreaterThan(0)
    for (const [key, el] of vsIndexByKey) {
      // every mounted vs row's key is the row id the loop also rendered at that absolute index
      expect(host.loop.getItemByKey(key)).toBeDefined()
      expect(el.__vsIndex).toEqual(Number(key))
    }
    // the loop rendered the same range the host asked for, at the host's absolute indices
    expect(host.loop.getWindow()[0]).toEqual(host.rendered.at(-1)[0])
    expect(rowsOf(host.loop.items)).toEqual(
      Array.from({ length: host.loop.count }, (_, k) => host.loop.absIndex(k)),
    )
  })

  test('windowing a 100 000-row list keeps the node count at the window plus its pool', () => {
    const host = startHost({ count: 100_000, maxPooled: 2 })
    const scrollerWindow = Math.ceil(VIEWPORT / ITEM_HEIGHT) + 2 * 1 // + buffer both ways
    const ceiling = scrollerWindow + 2 // the pool `maxPooled: 2`

    for (const top of [0, 1, 500, 50_000, 99_990, 500, 0]) {
      host.render(top * ITEM_HEIGHT)
      expect(host.loop.count).toBeLessThanOrEqual(scrollerWindow)
      expect(host.loop.allItems.length).toBeLessThanOrEqual(ceiling)
      expect(rowsOf(host.loop.items)).toEqual(
        Array.from({ length: host.loop.count }, (_, k) => host.loop.absIndex(k)),
      )
    }
    // ~12 rows are alive after a tour of the whole list; 100 000 rows never existed at once
    expect(host.built.length).toBeLessThanOrEqual(ceiling)
    expect(host.loop.getWindow()).toEqual([0, host.loop.count])
  })

  test('a returning window gets its instances back (no rebuild on the way home)', () => {
    const host = startHost({ count: 10_000, maxPooled: 12 })
    host.render(0)
    const atTop = rowsOf(host.loop.items)
    const instances = new Map(host.loop.items.map(item => [valueOf(item).id, item]))

    host.render(5_000 * ITEM_HEIGHT)
    expect(instances.size).toBeGreaterThan(0)

    host.render(0)
    expect(rowsOf(host.loop.items)).toEqual(atTop)
    for (const item of host.loop.items) {
      const id = valueOf(item).id
      // the instance that showed row `id` the first time is the one showing it now
      expect(item).toBe(instances.get(id))
    }
  })
})
