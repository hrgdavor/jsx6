import { expect, test } from 'bun:test'

import { calcPos } from '../src/calcPos.js'
import { getBlocksBounds } from '../src/getBlocksBounds.js'
import { getBlocksMinXY } from '../src/getBlocksMinXY.js'
import { makeLineConnector } from '../src/makeLineConnector.js'
import { pairChanged, pairSum } from '../src/pairUtils.js'

/**
 * Minimal stand-in for an element in a positioned chain: `calcPos` only reads
 * `offsetTop`/`offsetLeft`/`clientTop`/`clientLeft` and walks `offsetParent`.
 * @param {[number, number]} offset [offsetTop, offsetLeft]
 * @param {[number, number]} [client] [clientTop, clientLeft]
 */
const fakeEl = ([top, left], [clientTop, clientLeft] = [0, 0]) => {
  /** @type {any} */
  return { offsetTop: top, offsetLeft: left, clientTop, clientLeft, offsetParent: null }
}

test('getBlocksBounds: empty input is the zero box', () => {
  for (const blocks of [undefined, null, []]) {
    expect(getBlocksBounds(blocks)).toEqual({ x: 0, y: 0, maxx: 0, maxy: 0, w: 0, h: 0 })
  }
})

test('getBlocksBounds: a single block is its own bounding box', () => {
  expect(getBlocksBounds([{ pos: [10, 20], size: [30, 40] }])).toEqual({
    x: 10,
    y: 20,
    maxx: 40,
    maxy: 60,
    w: 30,
    h: 40,
  })
})

test('getBlocksBounds: spans every block, size is the extent', () => {
  const blocks = [
    { pos: [10, 20], size: [10, 10] }, // 10,20 .. 20,30
    { pos: [-5, 100], size: [10, 10] }, // -5,100 .. 5,110
    { pos: [50, 0], size: [20, 30] }, // 50,0 .. 70,30
  ]
  const bounds = getBlocksBounds(blocks)
  expect(bounds).toEqual({ x: -5, y: 0, maxx: 70, maxy: 110, w: 75, h: 110 })
  // the extremes are the blocks' corners, not their origins
  expect(bounds.maxx).toBe(Math.max(...blocks.map(b => b.pos[0] + b.size[0])))
  expect(bounds.maxy).toBe(Math.max(...blocks.map(b => b.pos[1] + b.size[1])))
})

test('getBlocksBounds: does not mutate the blocks', () => {
  const blocks = [{ pos: [1, 2], size: [3, 4] }]
  const snapshot = JSON.stringify(blocks)
  getBlocksBounds(blocks)
  expect(JSON.stringify(blocks)).toBe(snapshot)
})

test('getBlocksMinXY: empty input is [0, 0]', () => {
  expect(getBlocksMinXY(undefined)).toEqual([0, 0])
  expect(getBlocksMinXY([])).toEqual([0, 0])
})

test('getBlocksMinXY: the smallest origin on each axis, size ignored', () => {
  const blocks = [
    { pos: [10, 20], size: [100, 100] },
    { pos: [-5, 100], size: [1, 1] },
    { pos: [50, 0], size: [1, 1] },
  ]
  expect(getBlocksMinXY(blocks)).toEqual([-5, 0])
})

test('getBlocksMinXY: a single block reports its own origin', () => {
  expect(getBlocksMinXY([{ pos: [7, 8], size: [3, 4] }])).toEqual([7, 8])
})

test('calcPos: empty chain gives the zero offset', () => {
  expect(calcPos(null, null)).toEqual([0, 0])
})

test('calcPos: sums offset and client borders up to (excluding) the root', () => {
  const root = fakeEl([0, 0])
  const mid = fakeEl([30, 40], [2, 3])
  const child = fakeEl([10, 20], [1, 1])
  child.offsetParent = mid
  mid.offsetParent = root
  // left: 20+1+40+3, top: 10+1+30+2 — the root itself is never added
  expect(calcPos(child, root)).toEqual([64, 43])
})

test('calcPos: element that is the root contributes nothing', () => {
  const root = fakeEl([5, 6])
  expect(calcPos(root, root)).toEqual([0, 0])
})

test('calcPos: a detached (parentless) element still sums its own offsets', () => {
  // [offsetTop, offsetLeft] = [3, 4], [clientTop, clientLeft] = [1, 2]
  expect(calcPos(fakeEl([3, 4], [1, 2]), null)).toEqual([6, 4])
})

test('makeLineConnector: emits a cubic bezier between the two points', () => {
  const path = makeLineConnector(60, [0, 0], null, null, 'R', [100, 50], null, null, 'L')
  // one cubic segment whose control points sit on the horizontal through their
  // endpoint: `M x1 y1 C (x1+s) y1 (x2-s) y2 x2 y2`
  expect(path).toMatch(/^M0 0 C([\d.]+) 0 ([\d.]+) 50 100 50$/)
  const [, c1, c2] = path.match(/^M0 0 C([\d.]+) 0 ([\d.]+) 50 100 50$/)
  // the requested strength is used unless it exceeds half the endpoint distance
  expect(Number(c1)).toBeCloseTo(Math.min(60, Math.hypot(100, 50) / 2), 6)
  expect(Number(c2)).toBeCloseTo(100 - Number(c1), 6)
})

test('makeLineConnector: path shape is independent of the box arguments and direction', () => {
  const a = makeLineConnector(60, [0, 0], [1, 2], [3, 4], 'R', [100, 50], [5, 6], [7, 8], 'L')
  const b = makeLineConnector(60, [0, 0], null, null, 'L', [100, 50], null, null, 'R')
  expect(a).toBe(b)
  expect(a).toMatch(/^M-?\d+(\.\d+)? -?\d+(\.\d+)? C/)
  expect((a.match(/C/g) || []).length).toBe(1)
})

test('makeLineConnector: strength is clamped to half the point distance', () => {
  // 3-4-5 triangle: distance 5, so at most 2.5 of pull on each end
  expect(makeLineConnector(60, [0, 0], null, null, 'R', [3, 4], null, null, 'L')).toBe('M0 0 C2.5 0 0.5 4 3 4')
  // a strength below that limit is used as-is
  expect(makeLineConnector(1, [0, 0], null, null, 'R', [3, 4], null, null, 'L')).toBe('M0 0 C1 0 2 4 3 4')
})

test('makeLineConnector: zero-length connection still yields a valid path', () => {
  expect(makeLineConnector(60, [10, 10], null, null, 'R', [10, 10], null, null, 'L')).toBe('M10 10 C10 10 10 10 10 10')
})

test('pairUtils: pairChanged compares both components, by value', () => {
  expect(pairChanged([1, 2], [1, 2])).toBe(false)
  expect(pairChanged([1, 2], [2, 2])).toBe(true)
  expect(pairChanged([1, 2], [1, 3])).toBe(true)
  expect(pairChanged([1, 2], [1, 2, 3])).toBe(false)
  // identity does not matter, only the two numbers (positions are re-created constantly)
  expect(pairChanged([1, 2], Object.assign([1, 2], { extra: true }))).toBe(false)
})

test('pairUtils: pairSum adds componentwise and returns a new pair', () => {
  const a = [1, 2]
  const b = [3, 4]
  expect(pairSum(a, b)).toEqual([4, 6])
  expect(pairSum(a, b)).not.toBe(a)
  // the inputs are untouched
  expect(a).toEqual([1, 2])
  expect(b).toEqual([3, 4])
})
