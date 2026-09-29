import { expect, test } from 'bun:test'

import {
  distToSegment,
  edgeDistance,
  edgeToPath,
  makeConnector,
  packEdges,
  parseLinePath,
  pickEdge,
  sampleCubic,
  sampleTangent,
  screenToWorld,
  worldToScreen,
} from './index.js'

/** A straight-line Bezier: control points on the segment, so the point at t is (t, 0). */
const line = {
  x0: 0,
  y0: 0,
  cx0: 1 / 3,
  cy0: 0,
  cx1: 2 / 3,
  cy1: 0,
  x1: 1,
  y1: 0,
  color: [1, 0, 0, 1],
  width: 4,
}

/** A curve bulging up: point at t = 0.5 is exactly (0.5, 0.75). */
const bulge = {
  x0: 0,
  y0: 0,
  cx0: 0,
  cy0: 1,
  cx1: 1,
  cy1: 1,
  x1: 1,
  y1: 0,
  color: [0, 1, 0, 1],
  width: 2,
}

function expectVec(actual, x, y) {
  expect(Math.abs(actual[0] - x)).toBeLessThan(1e-9)
  expect(Math.abs(actual[1] - y)).toBeLessThan(1e-9)
}

test('sampleCubic evaluates endpoints and midpoints', () => {
  expectVec(sampleCubic(line, 0), 0, 0)
  expectVec(sampleCubic(line, 1), 1, 0)
  expectVec(sampleCubic(line, 0.5), 0.5, 0)
})

test('sampleCubic matches the analytic value of a bulged curve', () => {
  expectVec(sampleCubic(bulge, 0.5), 0.5, 0.75)
})

test('sampleTangent is constant on a straight segment', () => {
  expectVec(sampleTangent(line, 0), 1, 0)
  expectVec(sampleTangent(line, 0.5), 1, 0)
  expectVec(sampleTangent(line, 1), 1, 0)
})

test('distToSegment clamps the projection to the segment', () => {
  expect(distToSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3)
  expect(distToSegment(-1, 0, 0, 0, 10, 0)).toBeCloseTo(1)
  expect(distToSegment(11, 0, 0, 0, 10, 0)).toBeCloseTo(1)
  expect(distToSegment(3, 0, 3, 0, 3, 0)).toBeCloseTo(0)
})

test('edgeDistance approximates the distance to the curve', () => {
  expect(edgeDistance(line, 0.5, 2)).toBeCloseTo(2)
  expect(edgeDistance(bulge, 0.5, 0.75)).toBeCloseTo(0, 3)
  expect(edgeDistance(bulge, 0.5, 0.5)).toBeCloseTo(0.25, 2)
})

test('screenToWorld and worldToScreen are inverses', () => {
  const [wx, wy] = screenToWorld(100, 50, 30, 20, 2.5)
  expect(wx).toBeCloseTo(28)
  expect(wy).toBeCloseTo(12)
  const [sx, sy] = worldToScreen(wx, wy, 30, 20, 2.5)
  expect(sx).toBeCloseTo(100)
  expect(sy).toBeCloseTo(50)
})

test('pickEdge hits a curve inside its screen-space pick area', () => {
  const [sx, sy] = worldToScreen(0.5, 0.3, 0, 0, 2)
  expect(pickEdge([line], sx, sy, 0, 0, 2)).toBe(line)
})

test('pickEdge misses clicks far from any curve', () => {
  expect(pickEdge([line], 100, 100, 0, 0, 2)).toBeNull()
})

test('pickEdge threshold is zoom-independent (screen pixels)', () => {
  // width 4 -> pick radius (4/2 + 5) = 7 screen px at ANY zoom
  const [sxNear, syNear] = worldToScreen(0.5, 0.2, 0, 0, 20)
  expect(pickEdge([line], sxNear, syNear, 0, 0, 20)).toBe(line) // 4 screen px from the line
  const [sxFar, syFar] = worldToScreen(0.5, 0.5, 0, 0, 20)
  expect(pickEdge([line], sxFar, syFar, 0, 0, 20)).toBeNull() // 10 screen px from the line
})

test('pickEdge finds the closest of several candidates', () => {
  const a = { ...line, color: [1, 0, 0, 1] }
  const b = { ...line, y0: 0.2, cy0: 0.2, cy1: 0.2, y1: 0.2, color: [0, 0, 1, 1] }
  const [sx, sy] = worldToScreen(0.5, 0.2, 0, 0, 1)
  expect(pickEdge([a, b], sx, sy, 0, 0, 1)).toBe(b)
})

test('packEdges writes the 16-float GPU layout', () => {
  const packed = packEdges([line, { ...line, x0: 7, y0: 8 }])
  expect(packed.length).toBe(32)
  expect(packed[0]).toBe(0)
  expect(packed[1]).toBe(0)
  expect(packed[2]).toBeCloseTo(1 / 3)
  expect(packed[3]).toBe(0)
  expect(packed[4]).toBeCloseTo(2 / 3)
  expect(packed[5]).toBe(0)
  expect(packed[6]).toBe(1)
  expect(packed[7]).toBe(0)
  expect(packed[8]).toBe(1)
  expect(packed[9]).toBe(0)
  expect(packed[10]).toBe(0)
  expect(packed[11]).toBe(1)
  expect(packed[12]).toBe(4)
  expect(packed[13]).toBe(0)
  expect(packed[14]).toBe(0)
  expect(packed[15]).toBe(0)
  expect(packed[16]).toBe(7)
  expect(packed[17]).toBe(8)
})

test('parseLinePath parses nodditor connector paths', () => {
  const d = 'M351.95 148.96 C411.95 148.96 179.95 498.96 239.95 498.96'
  const edge = parseLinePath(d, { color: [0.2, 0.7, 1, 1], width: 4 })
  expect(edge.x0).toBe(351.95)
  expect(edge.y0).toBe(148.96)
  expect(edge.cx0).toBe(411.95)
  expect(edge.cy0).toBe(148.96)
  expect(edge.cx1).toBe(179.95)
  expect(edge.cy1).toBe(498.96)
  expect(edge.x1).toBe(239.95)
  expect(edge.y1).toBe(498.96)
  expect(edge.width).toBe(4)
  expect(edge.color).toEqual([0.2, 0.7, 1, 1])
})

test('parseLinePath rejects non-M/C input', () => {
  expect(() => parseLinePath('M0 0 L1 1')).toThrow()
  expect(() => parseLinePath('not a path')).toThrow()
})

test('edgeToPath round-trips parseLinePath', () => {
  const d = 'M351.95 148.96 C411.95 148.96 179.95 498.96 239.95 498.96'
  expect(edgeToPath(parseLinePath(d))).toBe(d)
})

test('makeConnector uses the nodditor strength formula', () => {
  expect(makeConnector([0, 0], [100, 50], 40)).toBe('M0 0 C40 0 60 50 100 50')
  // strength clamped to half the point distance
  expect(makeConnector([0, 0], [10, 0], 999)).toBe('M0 0 C5 0 5 0 10 0')
})
