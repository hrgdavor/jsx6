import { describe, expect, test, beforeEach } from 'bun:test'
import { VirtualScroll } from '../src/virtual-scroll.js'
import { DUMMY_ITEMS_CONTAINER } from './helpers.js'

describe('Virtual scroll', () => {
  let vs
  const TOTAL_ITEMS = 10
  const items = Array.from({ length: TOTAL_ITEMS }, (_, i) => ({ id: `item-${i}` }))
  const ITEM_HEIGHT = 10
  const ENOUGH_HEIGHT = 10_0000

  const createItem = () => {
    const $el = document.createElement('div')
    $el.textContent = ''
    $el.updateCount = 0
    return $el
  }

  const updateItemContent = (element, item) => {
    element.updateCount++
    element.textContent = `id:${item.id}`
  }

  beforeEach(() => {
    vs = new VirtualScroll({
      createItem: () => ({ style: {} }),
      updateItemContent: () => ({}),
      itemHeight: ITEM_HEIGHT,
      items,
      itemsContainer: DUMMY_ITEMS_CONTAINER,
    })
  })

  test('with no items, no items are rendered', () => {
    const vs = new VirtualScroll({
      items: [],
    })
    vs.updateViewport(100, 0)
    expect(vs.idDomMap).toBeEmpty()
  })

  test('with 0px height, no items are rendered', () => {
    vs.updateViewport(0, 0)
    expect(vs.idDomMap).toBeEmpty()
  })

  test('with 1px container height, first item is rendered at height 0', () => {
    vs.updateViewport(1, 0)
    expect(vs.idDomMap.get(items[0].id)).toBeAtPosition(0)
  })

  test('when height shrinks from two items to one, the second item moves into unusedPool', () => {
    vs.updateViewport(ITEM_HEIGHT + 1, 0)
    expect(vs.idDomMap.get(items[0].id)).toBeAtPosition(0)
    const secondElement = vs.idDomMap.get(items[1].id)
    expect(secondElement).toBeAtPosition(1)

    vs.updateViewport(1, 0)
    expect(vs.idDomMap.get(items[0].id)).toBeAtPosition(0)
    expect(vs.unusedPool[0]).toBe(secondElement)
  })

  test('when scrolling from two items to one, the first item moves into unusedPool', () => {
    vs.updateViewport(ENOUGH_HEIGHT, 0)

    const secondElement = vs.idDomMap.get(items[1].id)
    const firstElement = vs.idDomMap.get(items[0].id)
    expect(vs.idDomMap.get(items[0].id)).toBeAtPosition(0)
    expect(secondElement).toBeAtPosition(1)

    vs.updateViewport(ENOUGH_HEIGHT, ITEM_HEIGHT)
    expect(vs.idDomMap.get(items[1].id)).toBeAtPosition(1)
    expect(vs.unusedPool[0]).toBe(firstElement)
  })

  test('with buffer 1, shrinking height from two visible items to one still keeps both rendered', () => {
    vs.buffer = 1
    // Height for 2 items
    vs.updateViewport(ITEM_HEIGHT * 2, 0)
    expect(vs.idDomMap.get(items[0].id)).toBeAtPosition(0)
    expect(vs.idDomMap.get(items[1].id)).toBeAtPosition(1)

    // Shrink height to only fit 1 item
    vs.updateViewport(ITEM_HEIGHT, 0)

    // Both should still exist because item[1] is now in the bottom buffer
    expect(vs.idDomMap.get(items[0].id)).toBeAtPosition(0)
    expect(vs.idDomMap.get(items[1].id)).toBeAtPosition(1)
  })

  test('with buffer 1, scrolling past the first item keeps it rendered until it exits the buffer', () => {
    vs.buffer = 1
    vs.updateViewport(ENOUGH_HEIGHT, 0)

    const firstElement = vs.idDomMap.get(items[0].id)
    const secondElement = vs.idDomMap.get(items[1].id)

    expect(firstElement).toBeAtPosition(0)
    expect(secondElement).toBeAtPosition(1) // Rendered via buffer

    // Scroll so item[0] is completely off-screen
    vs.updateViewport(ENOUGH_HEIGHT, ITEM_HEIGHT)

    // item[0] should still be in DOM because of buffer (top buffer)
    expect(vs.idDomMap.get(items[0].id)).toBeAtPosition(0)
    expect(vs.idDomMap.get(items[1].id)).toBeAtPosition(1)
    expect(vs.unusedPool).toBeEmpty()

    // Scroll further so item[0] is beyond the buffer range
    vs.updateViewport(ENOUGH_HEIGHT, ITEM_HEIGHT * 2)

    // Now item[0] should finally be pooled
    expect(vs.idDomMap.get(items[0].id)).toBeUndefined()
    expect(vs.unusedPool[0]).toBe(firstElement)
  })

  test('cycling items: scrolling down then back up reuses elements', () => {
    // 1. Initial: Render first 2 items
    vs.updateViewport(ITEM_HEIGHT * 2, 0)
    const firstElem = vs.idDomMap.get('item-0')
    const secondElem = vs.idDomMap.get('item-1')

    // 2. Scroll down: item-0 and item-1 should go to pool
    vs.updateViewport(ITEM_HEIGHT * 2, ITEM_HEIGHT * 5)

    // 3. Scroll back to top: Should reuse those elements
    vs.updateViewport(ITEM_HEIGHT * 2, 0)
    expect(vs.idDomMap.get('item-0')).toBe(firstElem) // Reference equality check
    expect(vs.idDomMap.get('item-0')).toBeAtPosition(0)
    expect(vs.unusedPool).toBeEmpty()
  })

  test('resizing: growing height pulls from pool, shrinking returns to pool', () => {
    vs.updateViewport(ITEM_HEIGHT, 0) // 1 item visible
    expect(vs.idDomMap.size).toBe(1)

    vs.updateViewport(ITEM_HEIGHT * 2, 0) // Grow
    expect(vs.idDomMap.size).toBe(2)

    vs.updateViewport(0, 0) // Shrink to nothing
    expect(vs.idDomMap).toBeEmpty()
    expect(vs.unusedPool.length).toBe(2)
  })

  test('render() before updateViewport() does nothing', () => {
    vs.render(0)
    expect(vs.idDomMap).toBeEmpty()
    expect(vs.unusedPool).toBeEmpty()
  })

  test('offsetTop shifts the visible range', () => {
    const vs2 = new VirtualScroll({
      createItem,
      updateItemContent,
      itemHeight: 80,
      offsetTop: 80,
      items,
      itemsContainer: DUMMY_ITEMS_CONTAINER,
    })
    // Viewport [160, 640): rows 1..6 (row 1 spans [160, 240))
    vs2.updateViewport(480, 160)
    const mounted = [...vs2.idDomMap.values()].map(el => el.__vsIndex)
    expect(mounted).toEqual([1, 2, 3, 4, 5, 6])
  })

  test('offsetTop: nothing is visible while the viewport is above the list', () => {
    const vs2 = new VirtualScroll({
      createItem,
      updateItemContent,
      itemHeight: 80,
      offsetTop: 80,
      items,
      itemsContainer: DUMMY_ITEMS_CONTAINER,
    })
    // Viewport [0, 80) is entirely above the list (which starts at y=80)
    vs2.updateViewport(80, 0)
    expect(vs2.idDomMap).toBeEmpty()
  })

  test('fractional scrollTop with buffer 0 leaves no gap at the bottom', () => {
    const vs2 = new VirtualScroll({
      createItem,
      updateItemContent,
      itemHeight: 80,
      items,
      itemsContainer: DUMMY_ITEMS_CONTAINER,
    })
    // Viewport [79, 579): rows 0..7 (row 7 spans [560, 640), a 19px sliver is visible)
    vs2.updateViewport(500, 79)
    const mounted = [...vs2.idDomMap.values()].map(el => el.__vsIndex)
    expect(mounted).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  test('duplicate keys in the visible range throw', () => {
    const dup = new VirtualScroll({
      createItem,
      updateItemContent,
      itemHeight: ITEM_HEIGHT,
      items: [{ id: 'a' }, { id: 'a' }, { id: 'b' }],
      itemsContainer: DUMMY_ITEMS_CONTAINER,
    })
    expect(() => dup.updateViewport(100, 0)).toThrow()
  })

  test('destroy() removes all managed elements and clears state', () => {
    const removed = []
    const vs2 = new VirtualScroll({
      createItem: () => ({
        style: {},
        remove() {
          removed.push(this)
        },
      }),
      updateItemContent: () => {},
      itemHeight: ITEM_HEIGHT,
      items,
      itemsContainer: DUMMY_ITEMS_CONTAINER,
    })
    vs2.updateViewport(ITEM_HEIGHT * 2, 0) // mount 2
    vs2.updateViewport(ITEM_HEIGHT, 0) // one goes to the pool
    expect(vs2.idDomMap.size).toBe(1)
    expect(vs2.unusedPool.length).toBe(1)

    vs2.destroy()
    expect(vs2.idDomMap).toBeEmpty()
    expect(vs2.unusedPool).toBeEmpty()
    expect(removed.length).toBe(2)
  })
})
