/**
 * The API added for everyday use: pushing changed data into rows that are already mounted, the two
 * numbers a host needs (content height, scroll position for an item), the pool hook that replaces a
 * "destroyItem" idea, and the `buffer` default.
 */
import { describe, expect, test } from 'bun:test'
import { VirtualScroll } from '../src/virtual-scroll.js'
import { isHidden, orphans, stubContainer, stubRow, visibleUntracked } from './helpers.js'

const items = (count, prefix = 'item') => Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}` }))

function harness({
  count = 10,
  itemHeight = 10,
  offsetTop = 0,
  buffer,
  onItemPooled,
  updateItemContent = () => {},
  scroller,
} = {}) {
  const container = stubContainer()
  const vs = new VirtualScroll({
    itemsContainer: container,
    scroller,
    itemHeight,
    offsetTop,
    buffer,
    onItemPooled,
    items: items(count),
    createItem: stubRow,
    updateItemContent,
  })
  return { vs, container }
}

describe('buffer', () => {
  test('defaults to one row above and below the viewport', () => {
    const ctx = harness({ count: 40 }) // itemHeight 10, so the viewport [100, 120) needs rows 10 and 11
    const { vs } = ctx
    vs.updateViewport(20, 100)

    expect([...vs.idDomMap.values()].map(el => el.__vsIndex).sort((a, b) => a - b)).toEqual([9, 10, 11, 12])

    // at the top edge it does not reach past the list
    vs.updateViewport(20, 0)
    expect([...vs.idDomMap.values()].map(el => el.__vsIndex).sort((a, b) => a - b)).toEqual([0, 1, 2])
  })

  test('buffer: 0 keeps only the rows the viewport overlaps', () => {
    const ctx = harness({ count: 40, buffer: 0 })
    ctx.vs.updateViewport(20, 100)
    expect([...ctx.vs.idDomMap.values()].map(el => el.__vsIndex).sort((a, b) => a - b)).toEqual([10, 11])
  })

  test('a larger buffer keeps more rows mounted', () => {
    const ctx = harness({ count: 40, buffer: 3 })
    ctx.vs.updateViewport(20, 100)
    expect([...ctx.vs.idDomMap.values()].map(el => el.__vsIndex).sort((a, b) => a - b)).toEqual([
      7, 8, 9, 10, 11, 12, 13, 14,
    ])
  })
})

describe('refreshVisible', () => {
  test('re-binds every mounted row with the current item data', () => {
    const ctx = harness({ count: 100, itemHeight: 10, buffer: 0 })
    const { vs } = ctx
    const updated = []
    vs.updateItemContent = (el, item) => updated.push(item.id)

    vs.updateViewport(30, 0) // 3 rows fit in 30px
    expect(updated).toEqual(['item-0', 'item-1', 'item-2'])

    updated.length = 0
    vs.refreshVisible()
    expect(updated).toEqual(['item-0', 'item-1', 'item-2'])

    // and it reflects the data as it is now
    vs.items[1].id = 'renamed'
    updated.length = 0
    vs.refreshVisible()
    expect(updated).toEqual(['item-0', 'renamed', 'item-2'])
  })

  test('mounts and evicts nothing: it is not a render', () => {
    const ctx = harness({ count: 100, itemHeight: 10, buffer: 0 })
    const { vs, container } = ctx
    vs.updateViewport(30, 0) // rows 0..2
    const mounted = [...vs.idDomMap.keys()]
    const poolSize = vs.unusedPool.length

    vs.refreshVisible()

    expect([...vs.idDomMap.keys()]).toEqual(mounted)
    expect(vs.unusedPool.length).toBe(poolSize)
    expect(container.appended.length).toBe(vs.idDomMap.size + vs.unusedPool.length)
  })

  test('does not re-bind pooled rows: they are re-bound when they are reused', () => {
    const ctx = harness({ count: 100, itemHeight: 10, buffer: 0 })
    const { vs } = ctx
    vs.updateViewport(100, 0) // rows 0..9
    vs.updateViewport(30, 0) // rows 0..2: the other seven are pooled and stay parked
    expect(vs.unusedPool.length).toBe(7)
    const parked = [...vs.unusedPool]

    const seen = new Set()
    vs.updateItemContent = el => seen.add(el)

    vs.refreshVisible()
    expect(parked.some(el => seen.has(el))).toBe(false)
    expect([...seen]).toEqual([...vs.idDomMap.values()])
  })
})

describe('getTotalHeight', () => {
  test('is items.length * itemHeight + offsetTop, and follows the data', () => {
    const ctx = harness({ count: 10, itemHeight: 40, offsetTop: 80 })
    const { vs } = ctx
    expect(vs.getTotalHeight()).toBe(10 * 40 + 80)

    vs.items = items(3)
    expect(vs.getTotalHeight()).toBe(3 * 40 + 80)

    vs.itemHeight = 20
    expect(vs.getTotalHeight()).toBe(3 * 20 + 80)

    vs.items = []
    expect(vs.getTotalHeight()).toBe(80)
  })
})

describe('getScrollTopForIndex', () => {
  test('returns the offset of the item, unclamped until a viewport has been measured', () => {
    const ctx = harness({ count: 10, itemHeight: 10 })
    const { vs } = ctx
    expect(vs.getScrollTopForIndex(0)).toBe(0)
    expect(vs.getScrollTopForIndex(3)).toBe(30)
    expect(vs.getScrollTopForIndex(9)).toBe(90)
  })

  test('clamps to the list so the last rows can actually reach the top', () => {
    const ctx = harness({ count: 10, itemHeight: 10 })
    const { vs } = ctx
    vs.updateViewport(50, 0) // total 100, so the last scrollTop is 50

    expect(vs.getScrollTopForIndex(0)).toBe(0)
    expect(vs.getScrollTopForIndex(3)).toBe(30)
    expect(vs.getScrollTopForIndex(9)).toBe(50) // 90 would overscroll
    expect(vs.getScrollTopForIndex(99)).toBe(50) // out of range
    expect(vs.getScrollTopForIndex(-5)).toBe(0)
  })

  test('honours offsetTop and a list shorter than the viewport', () => {
    const ctx = harness({ count: 10, itemHeight: 40, offsetTop: 80 })
    const { vs } = ctx
    vs.updateViewport(200, 0) // total 480 -> last scrollTop 280
    expect(vs.getScrollTopForIndex(0)).toBe(80)
    expect(vs.getScrollTopForIndex(9)).toBe(280)

    const small = harness({ count: 2, itemHeight: 40, offsetTop: 80 })
    small.vs.updateViewport(400, 0) // taller than the list
    expect(small.vs.getScrollTopForIndex(1)).toBe(0)
  })

  test('the item it points at is inside the viewport it was computed for', () => {
    for (const count of [1, 5, 40]) {
      for (const itemHeight of [7, 26.5]) {
        for (const containerHeight of [50, 500]) {
          const ctx = harness({ count, itemHeight, buffer: 0 })
          const { vs } = ctx
          vs.updateViewport(containerHeight, 0)
          for (const index of [0, count - 1, Math.floor(count / 2)]) {
            const scrollTop = vs.getScrollTopForIndex(index)
            const rowTop = index * itemHeight
            const rowBottom = rowTop + itemHeight
            expect(scrollTop).toBeGreaterThanOrEqual(0)
            expect(scrollTop + containerHeight).toBeGreaterThanOrEqual(rowBottom - 1e-9)
            expect(scrollTop).toBeLessThanOrEqual(Math.max(0, vs.getTotalHeight() - containerHeight) + 1e-9)
          }
        }
      }
    }
  })
})

describe('scrollToIndex', () => {
  test('sets the scroller offset and renders the range for it in one step', () => {
    const scroller = { scrollTop: 0 }
    const ctx = harness({ count: 1000, itemHeight: 20, buffer: 0, scroller })
    const { vs } = ctx
    vs.updateViewport(200, 0)

    vs.scrollToIndex(500)

    expect(scroller.scrollTop).toBe(10000) // 500 * 20, the offset has to match the rows
    const mounted = [...vs.idDomMap.values()].map(el => el.__vsIndex).sort((a, b) => a - b)
    expect(mounted).toEqual([500, 501, 502, 503, 504, 505, 506, 507, 508, 509]) // 200px / 20px
    // and the row for the index is where the offset says it is
    expect([...vs.idDomMap.values()].find(el => el.__vsIndex === 500).style.transform).toBe(
      'translate3d(0, 10000px, 0)',
    )
  })

  test('renders for the offset the browser settled on, not the one it asked for', () => {
    const scroller = {
      // a real scroller clamps to its extent and rounds; the range has to follow what it reports
      set scrollTop(value) {
        this._t = Math.min(value, 19800)
      },
      get scrollTop() {
        return this._t
      },
      _t: 0,
    }
    const ctx = harness({ count: 1000, itemHeight: 20, buffer: 0, scroller })
    const { vs } = ctx
    vs.updateViewport(200, 0) // total 20000 -> last offset 19800

    vs.scrollToIndex(999) // wants 19980, the scroller stops at 19800

    expect(scroller.scrollTop).toBe(19800)
    const mounted = [...vs.idDomMap.values()].map(el => el.__vsIndex).sort((a, b) => a - b)
    expect(mounted).toEqual([990, 991, 992, 993, 994, 995, 996, 997, 998, 999])
  })

  test('honours itemHeight and offsetTop', () => {
    const scroller = { scrollTop: 0 }
    const ctx = harness({ count: 100, itemHeight: 40, offsetTop: 80, buffer: 0, scroller })
    const { vs } = ctx
    vs.updateViewport(200, 0)

    vs.scrollToIndex(5)
    expect(scroller.scrollTop).toBe(5 * 40 + 80)
  })

  test('says what to do when no scroller was configured', () => {
    const ctx = harness({ count: 100, itemHeight: 20 })
    ctx.vs.updateViewport(200, 0)
    expect(() => ctx.vs.scrollToIndex(5)).toThrow('needs `scroller`')
  })
})

describe('onItemPooled', () => {
  test('fires once per row that leaves the viewport, after the row has been parked', () => {
    const pooled = []
    const ctx = harness({ count: 100, itemHeight: 10, buffer: 0, onItemPooled: el => pooled.push(el) })
    const { vs } = ctx

    vs.updateViewport(100, 0) // rows 0..9
    expect(pooled).toEqual([])

    vs.updateViewport(30, 0) // rows 0..2 stay: seven rows are parked for good
    expect(pooled.length).toBe(7)
    expect(new Set(pooled).size).toBe(7) // once each
    expect(pooled.every(el => isHidden(el))).toBe(true) // hidden before the host is told
    expect(pooled.every(el => vs.unusedPool.includes(el))).toBe(true)
  })

  test('destroy() does not call it: the rows are removed, not parked', () => {
    const pooled = []
    const ctx = harness({ count: 100, itemHeight: 10, buffer: 0, onItemPooled: el => pooled.push(el) })
    const { vs } = ctx
    vs.updateViewport(30, 0)
    vs.destroy()
    expect(pooled).toEqual([])
  })

  test('a throwing hook still pools every row, then surfaces the first error', () => {
    let calls = 0
    const ctx = harness({
      count: 100,
      itemHeight: 10,
      buffer: 0,
      onItemPooled: () => {
        calls++
        throw new Error(`hook exploded (${calls})`)
      },
    })
    const { vs } = ctx
    vs.updateViewport(30, 0) // rows 0..2, nothing pooled
    expect(calls).toBe(0)

    // Growing the viewport mounts more rows; shrinking it again parks them, and the hook throws
    // every time. Every row still gets parked and the first error is what surfaces.
    vs.updateViewport(50, 0)
    expect(() => vs.updateViewport(30, 0)).toThrow('hook exploded (1)')
    expect(calls).toBe(2)
    expect(vs.unusedPool.length).toBe(2)
    expect(orphans(ctx)).toEqual([])
    expect(visibleUntracked(ctx)).toEqual([])
    expect(ctx.container.appended.length).toBe(vs.idDomMap.size + vs.unusedPool.length)

    // the frame failed after parking but before finishing, so the next render recovers from the pool
    vs.onItemPooled = () => {}
    vs.updateViewport(50, 0)
    expect(vs.idDomMap.size).toBe(5)
    expect(vs.unusedPool.length).toBe(0)
    expect([...vs.idDomMap.values()].map(el => el.__vsIndex).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
  })
})

describe('edge cases a host can hit', () => {
  test('destroy() is idempotent and nothing re-mounts afterwards', () => {
    const scroller = { scrollTop: 0 }
    const ctx = harness({ count: 100, itemHeight: 10, buffer: 0, scroller })
    const { vs, container } = ctx
    vs.updateViewport(50, 0)
    const appended = container.appended.length
    expect(appended).toBeGreaterThan(0)

    vs.destroy()
    expect(() => vs.destroy()).not.toThrow()
    expect(vs.idDomMap.size).toBe(0)
    expect(vs.unusedPool.length).toBe(0)

    // render() and scrollToIndex() are quiet on a destroyed instance (no viewport height stored)
    expect(() => vs.render(0)).not.toThrow()
    expect(() => vs.scrollToIndex(10)).not.toThrow()
    expect(container.appended.length).toBe(appended) // nothing new was mounted
    expect(vs.idDomMap.size).toBe(0)
  })

  test('refreshVisible() before any render does nothing', () => {
    const ctx = harness({ count: 10 })
    expect(() => ctx.vs.refreshVisible()).not.toThrow()
    expect(ctx.vs.idDomMap.size).toBe(0)
  })

  test('an empty list has a sane total height and scroll offset', () => {
    const ctx = harness({ count: 0, itemHeight: 40, offsetTop: 80 })
    const { vs } = ctx
    vs.updateViewport(200, 0)
    expect(vs.getTotalHeight()).toBe(80)
    expect(vs.getScrollTopForIndex(0)).toBe(0) // never a negative scroll
    expect(vs.getScrollTopForIndex(50)).toBe(0)
    expect(vs.idDomMap.size).toBe(0)
  })

  test('a list shorter than the viewport never scrolls', () => {
    const scroller = { scrollTop: 0 }
    const ctx = harness({ count: 3, itemHeight: 10, scroller })
    const { vs } = ctx
    vs.updateViewport(400, 0) // taller than 30px of rows
    vs.scrollToIndex(2)
    expect(scroller.scrollTop).toBe(0)
    expect([...vs.idDomMap.values()].map(el => el.__vsIndex).sort((a, b) => a - b)).toEqual([0, 1, 2])
  })
})
