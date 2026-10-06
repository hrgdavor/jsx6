/**
 * Geometry sweep for the render range — the invariant a host actually depends on:
 *
 *   for any viewport height, scroll position, row height and offset, the rows that are mounted are
 *   exactly the ones the viewport needs (plus `buffer`), they sit on the `itemHeight` grid, and
 *   they tile the part of the list the viewport overlaps.
 *
 * It is deliberately DOM-free. happy-dom reports every `getBoundingClientRect()` as `{0,0,0,0}`, so
 * positions are read from the `translate3d` the library writes — which is the rendering contract
 * itself — instead of from layout. That keeps the sweep cheap enough to run over the whole matrix,
 * and the same invariant was confirmed against real Blink layout (see plan notes): mounted set
 * exact, positions exact to 0.000px, no seams, band fully covered.
 */
import { describe, expect, test } from 'bun:test'
import { VirtualScroll } from '../src/virtual-scroll.js'
import { isHidden, isShown, orphans, POOLED_CLASS, stubContainer, stubRow } from './helpers.js'

const TRANSLATE = /^translate3d\(0, ([-0-9.]+)px, 0\)$/
const EPS = 1e-9

/** The y a row is positioned at, straight out of its transform. */
function rowTop(el) {
  const match = TRANSLATE.exec(el.style.transform)
  return match ? Number(match[1]) : NaN
}

function harness({ len, itemHeight, buffer = 0, offsetTop = 0, hiddenClass }) {
  const container = stubContainer()
  const created = []
  const vs = new VirtualScroll({
    itemsContainer: container,
    itemHeight,
    buffer,
    offsetTop,
    hiddenClass,
    items: Array.from({ length: len }, (_, i) => ({ id: i })),
    createItem: () => {
      const el = stubRow()
      created.push(el)
      return el
    },
    updateItemContent: () => {},
  })
  return { vs, container, created }
}

/**
 * Run the invariant over every scroll position in `scrollTops`.
 * @returns the harness, for tests that want to inspect the surviving state.
 */
function sweep({ label, len, itemHeight, buffer = 0, offsetTop = 0, containerHeight, scrollTops }) {
  const ctx = harness({ len, itemHeight, buffer, offsetTop })
  const { vs, container } = ctx
  vs.updateViewport(containerHeight, scrollTops[0])

  const problems = []
  for (const scrollTop of scrollTops) {
    vs.render(scrollTop)

    const tops = [...vs.idDomMap.values()].map(rowTop).sort((a, b) => a - b)
    // The index is recovered from the transform, so it is rounded back first; the grid check below
    // then still requires the transform to be exactly `index * itemHeight + offsetTop`.
    const entries = tops.map(top => ({ top, index: Math.round((top - offsetTop) / itemHeight) }))
    const indices = entries.map(entry => entry.index)
    const firstVisible = Math.max(0, Math.floor((scrollTop - offsetTop) / itemHeight))
    const lastVisible = Math.min(
      len - 1,
      Math.ceil((scrollTop + containerHeight - offsetTop) / itemHeight) - 1,
    )
    const lowest = Math.max(0, firstVisible - buffer)
    const highest = Math.min(len - 1, lastVisible + buffer)

    const note = detail => problems.push({ scrollTop, ...detail })

    // 1. every mounted row sits on the grid, inside the list
    const offGrid = entries.filter(
      entry =>
        entry.index < 0 ||
        entry.index >= len ||
        Math.abs(entry.index * itemHeight + offsetTop - entry.top) > 1e-9,
    )
    if (offGrid.length) note({ offGrid: offGrid.slice(0, 3) })

    // 2. exactly the needed rows, expanded by buffer and clamped to the list
    const mounted = new Set(indices)
    const missing = []
    for (let i = lowest; i <= highest; i++) if (!mounted.has(i)) missing.push(i)
    const extra = [...mounted].filter(i => i < lowest || i > highest)
    if (missing.length || extra.length) note({ missing: missing.slice(0, 3), extra: extra.slice(0, 3) })

    // 3. no holes between neighbours
    for (let k = 1; k < indices.length; k++) {
      if (indices[k] !== indices[k - 1] + 1) {
        note({ holeBetween: [indices[k - 1], indices[k]] })
        break
      }
    }

    // 4. the rows tile the overlap of viewport and list — no blank band at either edge
    const overlapTop = Math.max(scrollTop, offsetTop)
    const overlapBottom = Math.min(scrollTop + containerHeight, offsetTop + len * itemHeight)
    if (overlapBottom > overlapTop && tops.length) {
      if (tops[0] - overlapTop > EPS) note({ gapAtTop: tops[0] - overlapTop })
      const coveredBottom = tops[tops.length - 1] + itemHeight
      if (overlapBottom - coveredBottom > EPS) note({ gapAtBottom: overlapBottom - coveredBottom })
    }

    // 5. nothing leaks out of the two pools while scrolling
    const leaked = orphans(ctx)
    if (leaked.length) note({ orphans: leaked.length })
  }

  expect(problems.slice(0, 3), label).toEqual([])
  // every element ever created was appended exactly once and is still mounted or pooled
  expect(container.appended.length, `${label}: pool accounting`).toBe(vs.idDomMap.size + vs.unusedPool.length)
  return ctx
}

// The matrix the browser probe used, over every combination of buffer, offsetTop, viewport height
// and list length — including empty lists and heights that are fractional (26.5) or off-grid
// (133.333), which is where naive index/edge math drifts.
const ITEM_HEIGHTS = [1, 10, 26.5, 80, 133.333]
const BUFFERS = [0, 1, 3]
const OFFSETS = [0, 80, 7.5]
const VIEWPORTS = [1, 137, 500, 5000]
const LENGTHS = [0, 1, 7, 100, 10000]

describe('render range geometry', () => {
  for (const itemHeight of ITEM_HEIGHTS) {
    test(`tiles the viewport for itemHeight=${itemHeight} (${BUFFERS.length * OFFSETS.length * VIEWPORTS.length * LENGTHS.length} configs)`, () => {
      for (const buffer of BUFFERS) {
        for (const offsetTop of OFFSETS) {
          for (const containerHeight of VIEWPORTS) {
            for (const len of LENGTHS) {
              const extent = offsetTop + len * itemHeight
              const label = `ih=${itemHeight} buffer=${buffer} offsetTop=${offsetTop} h=${containerHeight} len=${len}`
              sweep({
                label,
                len,
                itemHeight,
                buffer,
                offsetTop,
                containerHeight,
                // overscroll (negative), fractional positions, both list edges, and past the end
                scrollTops: [
                  -63.5,
                  -1,
                  0,
                  0.5,
                  1,
                  7.25,
                  81,
                  429.4,
                  extent / 2,
                  extent - 0.25,
                  extent,
                  extent + 0.5,
                  extent + 250,
                  extent * 2 + 10,
                ],
              })
            }
          }
        }
      }
    })
  }
})

describe('element pool', () => {
  test('recycles a bounded number of rows instead of creating one per scrolled row', () => {
    const ctx = harness({ len: 100000, itemHeight: 20 })
    const { vs, created } = ctx
    vs.updateViewport(300, 0)

    let maxLive = 0
    for (let step = 0; step < 500; step++) {
      vs.render(step * 20)
      maxLive = Math.max(maxLive, vs.idDomMap.size)
    }

    // 300px / 20px => 15 rows are mounted at most, whatever the scroll distance
    expect(maxLive).toBe(15)
    expect(created.length).toBeLessThanOrEqual(maxLive + 1)
    expect(orphans(ctx)).toEqual([])
  })

  test('destroy() removes every element ever handed to the container', () => {
    const ctx = harness({ len: 10000, itemHeight: 40 })
    const { vs, container } = ctx
    vs.updateViewport(200, 0)
    for (let step = 0; step < 50; step++) vs.render(step * 40)

    expect(container.appended.length).toBeGreaterThan(0)
    vs.destroy()

    expect(container.appended.every(el => el.removed)).toBe(true)
    expect(vs.idDomMap.size).toBe(0)
    expect(vs.unusedPool.length).toBe(0)
  })

  test('pooled rows are hidden with display: none by default', () => {
    const ctx = harness({ len: 100, itemHeight: 20 })
    const { vs } = ctx
    vs.updateViewport(200, 0) // rows 0..9
    expect([...vs.idDomMap.values()].every(isShown)).toBe(true)

    vs.updateViewport(100, 0) // rows 0..4, the other five are pooled
    expect(vs.unusedPool.length).toBe(5)
    for (const el of vs.unusedPool) {
      expect(el.style.display).toBe('none')
      // the layout-preserving pair is the opt-in alternative, never written unless asked for
      expect(el.style.contentVisibility).toBeUndefined()
      expect(el.style.visibility).toBeUndefined()
      expect(isHidden(el)).toBe(true)
    }

    // and the pool hands them back visible again
    vs.updateViewport(200, 0)
    expect(vs.unusedPool.length).toBe(0)
    expect([...vs.idDomMap.values()].every(el => el.style.display === '')).toBe(true)
    expect([...vs.idDomMap.values()].every(isShown)).toBe(true)
  })

  test('hiddenClass mode toggles the class only, leaving the mechanism to the host CSS', () => {
    const ctx = harness({ len: 100, itemHeight: 20, hiddenClass: POOLED_CLASS })
    const { vs } = ctx
    vs.updateViewport(200, 0) // rows 0..9
    expect([...vs.idDomMap.values()].every(isShown)).toBe(true)

    vs.updateViewport(100, 0) // rows 0..4, the other five are pooled
    expect(vs.unusedPool.length).toBe(5)
    for (const el of vs.unusedPool) {
      expect(el.classList.contains(POOLED_CLASS)).toBe(true)
      // no hiding style inline: the host stylesheet owns how a pooled row is hidden
      expect(el.style.display).toBeUndefined()
      expect(el.style.contentVisibility).toBeUndefined()
      expect(el.style.visibility).toBeUndefined()
      expect(isHidden(el)).toBe(true)
    }

    vs.updateViewport(200, 0)
    expect(vs.unusedPool.length).toBe(0)
    expect([...vs.idDomMap.values()].every(el => el.classList.contains(POOLED_CLASS) === false)).toBe(true)
  })

  test('hiddenClass mode hides the row whose binder threw the same way', () => {
    const container = stubContainer()
    const vs = new VirtualScroll({
      itemsContainer: container,
      itemHeight: 20,
      hiddenClass: POOLED_CLASS,
      items: [{ id: 0 }, { id: 1 }, { id: 2 }],
      createItem: stubRow,
      updateItemContent: () => {
        throw new Error('binder exploded')
      },
    })

    expect(() => vs.updateViewport(200, 0)).toThrow('binder exploded')
    expect(vs.unusedPool.length).toBe(1)
    expect(vs.unusedPool[0].classList.contains(POOLED_CLASS)).toBe(true)
    expect(vs.unusedPool[0].style.display).toBeUndefined()
  })
})
