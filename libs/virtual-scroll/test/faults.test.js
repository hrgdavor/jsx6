/**
 * Faults must not corrupt the instance.
 *
 * Two classes of fault are covered:
 *
 * - **Duplicate keys** are a data smell, not a crash: the first occurrence is rendered, the later
 *   ones are skipped and reported (once per key while it stays duplicated), and the instance keeps
 *   working so the host can fix the data. The skipped slots have no row, which makes the fix visible.
 * - **A throwing caller callback** (`updateItemContent`, `createItem`) used to be able to orphan the
 *   row it was binding: the element stayed on screen, unreachable by `destroy()` and invisible to the
 *   next render. `render()` now recycles in a `finally`, so the invariant below holds no matter what.
 *
 * The invariant, asserted after every scenario: every element handed to the container is either
 * mounted or pooled, every visible element is tracked, and `destroy()` reclaims all of them.
 */
import { describe, expect, test } from 'bun:test'
import { VirtualScroll } from '../src/virtual-scroll.js'
import { isHidden, orphans, stubContainer, stubRow, visibleUntracked } from './helpers.js'

const unique = count => Array.from({ length: count }, (_, i) => ({ id: i }))

function harness({
  items,
  itemHeight = 10,
  buffer = 0,
  offsetTop = 0,
  updateItemContent = () => {},
  onDuplicateKey,
}) {
  const container = stubContainer()
  const vs = new VirtualScroll({
    itemsContainer: container,
    itemHeight,
    buffer,
    offsetTop,
    items,
    onDuplicateKey,
    createItem: stubRow,
    updateItemContent,
  })
  return { vs, container }
}

describe('a duplicate key is ignored and reported, never fatal', () => {
  const dupItems = [{ id: 0 }, { id: 0 }, { id: 1 }]

  test('the first occurrence is rendered, the duplicate is skipped and reported', () => {
    const reported = []
    const ctx = harness({
      items: dupItems,
      onDuplicateKey: (key, item, index) => reported.push({ key, item: item.id, index }),
    })
    const { vs } = ctx

    expect(() => vs.updateViewport(1000, 0)).not.toThrow()

    expect([...vs.idDomMap.keys()]).toEqual([0, 1])
    expect(reported).toEqual([{ key: 0, item: 0, index: 1 }])
    // rows keep their index positions, so the ignored item leaves a visible hole at y=10
    expect([...vs.idDomMap.values()].map(el => el.style.transform)).toEqual([
      'translate3d(0, 0px, 0)',
      'translate3d(0, 20px, 0)',
    ])
    expect(orphans(ctx)).toEqual([])
    expect(visibleUntracked(ctx)).toEqual([])
  })

  test('reported once while the key stays duplicated, and again when it comes back', () => {
    const reported = []
    const ctx = harness({ items: dupItems, onDuplicateKey: () => reported.push(1) })
    const { vs } = ctx

    vs.updateViewport(1000, 0)
    vs.render(0)
    vs.render(0)
    expect(reported.length).toBe(1)

    // scroll so the duplicate leaves the rendered range (only index 2 is left)
    vs.updateViewport(10, 20)
    expect([...vs.idDomMap.keys()]).toEqual([1])
    expect(reported.length).toBe(1)

    // back in range: reported again, because the data is still wrong
    vs.updateViewport(1000, 0)
    expect(reported.length).toBe(2)
  })

  test('reporting defaults to console.warn', () => {
    const warnings = []
    const original = console.warn
    console.warn = (...args) => warnings.push(args.join(' '))
    try {
      const ctx = harness({ items: [{ id: 7 }, { id: 7 }] })
      ctx.vs.updateViewport(1000, 0)
      ctx.vs.render(0)

      expect(warnings.length).toBe(1)
      expect(warnings[0]).toContain('duplicate key 7')
      expect(warnings[0]).toContain('index 1')
    } finally {
      console.warn = original
    }
  })

  test('a throwing reporter cannot break the frame or repeat on every scroll', () => {
    let calls = 0
    const ctx = harness({
      items: dupItems,
      onDuplicateKey: () => {
        calls++
        throw new Error('reporter exploded')
      },
    })
    const { vs } = ctx

    expect(() => vs.updateViewport(1000, 0)).toThrow('reporter exploded')
    // key recorded before the reporter ran, so scrolling does not call it again
    expect(() => vs.render(0)).not.toThrow()
    expect(calls).toBe(1)

    expect([...vs.idDomMap.keys()]).toEqual([0, 1])
    expect(orphans(ctx)).toEqual([])
    expect(visibleUntracked(ctx)).toEqual([])
  })

  test('many duplicates still leave every element accounted for', () => {
    const ctx = harness({
      items: [{ id: 0 }, { id: 0 }, { id: 0 }, { id: 1 }, { id: 1 }, { id: 2 }],
      onDuplicateKey: () => {},
    })
    const { vs, container } = ctx

    vs.updateViewport(1000, 0)
    expect([...vs.idDomMap.keys()]).toEqual([0, 1, 2])

    for (let step = 0; step < 20; step++) vs.render(step)
    expect(orphans(ctx)).toEqual([])
    expect(visibleUntracked(ctx)).toEqual([])
    expect(container.appended.length).toBe(vs.idDomMap.size + vs.unusedPool.length)

    vs.destroy()
    expect(container.appended.every(el => el.removed)).toBe(true)
  })

  test('a duplicate outside the rendered range is not reported', () => {
    const reported = []
    const ctx = harness({
      items: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 2 }],
      onDuplicateKey: () => reported.push(1),
    })
    ctx.vs.updateViewport(20, 0) // renders rows 0..1 only

    expect([...ctx.vs.idDomMap.keys()]).toEqual([0, 1])
    expect(reported).toEqual([])
  })
})

describe('a throwing caller callback does not orphan a row', () => {
  test('updateItemContent throwing mid-frame leaves every element mounted or pooled', () => {
    let boom = true
    const ctx = harness({
      items: unique(10),
      updateItemContent: (el, item) => {
        if (boom && item.id === 3) throw new Error('binder exploded')
      },
    })
    const { vs, container } = ctx

    expect(() => vs.updateViewport(1000, 0)).toThrow('binder exploded')

    // the frame is partial — that is allowed; what matters is that nothing leaked
    expect(vs.idDomMap.size).toBeGreaterThan(0)
    expect(orphans(ctx)).toEqual([])
    expect(visibleUntracked(ctx)).toEqual([])

    // the row whose binder threw is recycled, hidden the same way the pool hides every row
    expect(vs.unusedPool.length).toBe(1)
    expect(vs.unusedPool[0].style.display).toBe('none')
    expect(isHidden(vs.unusedPool[0])).toBe(true)

    // and the instance recovers, recycling the row whose binder threw
    boom = false
    expect(() => vs.render(0)).not.toThrow()
    expect(vs.idDomMap.size).toBe(10)
    expect(orphans(ctx)).toEqual([])

    vs.destroy()
    expect(container.appended.every(el => el.removed)).toBe(true)
  })

  test('createItem throwing when the pool is empty leaks nothing', () => {
    const container = stubContainer()
    let calls = 0
    const vs = new VirtualScroll({
      itemsContainer: container,
      itemHeight: 10,
      items: unique(10),
      createItem: () => {
        calls++
        if (calls === 3) throw new Error('factory exploded')
        return stubRow()
      },
      updateItemContent: () => {},
    })

    expect(() => vs.updateViewport(1000, 0)).toThrow('factory exploded')
    expect(orphans({ vs, container })).toEqual([])
    expect(visibleUntracked({ vs, container })).toEqual([])

    // the pool was empty, so the failed call consumed nothing
    expect(vs.unusedPool.length).toBe(0)

    expect(() => vs.render(0)).not.toThrow()
    expect(vs.idDomMap.size).toBe(10)
    expect(orphans({ vs, container })).toEqual([])
  })
})
