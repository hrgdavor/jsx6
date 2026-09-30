import { expect, test } from 'bun:test'

import {
  circleEdges,
  distToSegment,
  drawEdgesPixi,
  edgeDistance,
  edgeToPath,
  lineEdge,
  makeConnector,
  packEdges,
  parseLinePath,
  pickEdge,
  pixiStroke,
  polygonEdges,
  sampleCubic,
  sampleTangent,
  screenToWorld,
  toPixiColor,
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

test('pickEdge pick band scales with zoom for the default world-width edge', () => {
  // width 4 in world units -> 80 screen px wide at zoom 20 -> threshold max(40, 5)/20 = 2 world
  const [sxNear, syNear] = worldToScreen(0.5, 0.2, 0, 0, 20)
  expect(pickEdge([line], sxNear, syNear, 0, 0, 20)).toBe(line) // 0.2 world from the line
  const [sxFar, syFar] = worldToScreen(0.5, 3, 0, 0, 20)
  expect(pickEdge([line], sxFar, syFar, 0, 0, 20)).toBeNull() // 3 world from the line
})

test('pickEdge threshold is zoom-independent when worldWidth is false', () => {
  // width 4 in SCREEN pixels -> threshold max(4/2, 5)/20 = 0.25 world at ANY zoom
  const linePx = { ...line, worldWidth: false }
  const [sxNear, syNear] = worldToScreen(0.5, 0.2, 0, 0, 20)
  expect(pickEdge([linePx], sxNear, syNear, 0, 0, 20)).toBe(linePx) // 4 screen px from the line
  const [sxFar, syFar] = worldToScreen(0.5, 0.5, 0, 0, 20)
  expect(pickEdge([linePx], sxFar, syFar, 0, 0, 20)).toBeNull() // 10 screen px from the line
})

test('pickEdge with radiusPx 0 picks only exactly on the stroke', () => {
  // worldWidth false, width 4 screen px -> exact threshold = 2 screen px = 1 world at zoom 2
  const linePx = { ...line, worldWidth: false }
  const [sxOn, syOn] = worldToScreen(0.5, 0.2, 0, 0, 2) // 0.4 screen px from the line
  expect(pickEdge([linePx], sxOn, syOn, 0, 0, 2, 24, 0)).toBe(linePx)
  const [sxOff, syOff] = worldToScreen(0.5, 1.5, 0, 0, 2) // 3 screen px from the line
  expect(pickEdge([linePx], sxOff, syOff, 0, 0, 2, 24, 0)).toBeNull() // outside the exact stroke
  expect(pickEdge([linePx], sxOff, syOff, 0, 0, 2, 24, 8)).toBe(linePx) // generous radius picks it
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
  expect(packed[13]).toBe(1) // worldWidth defaults to true (WGSL float index 13)
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

test('toPixiColor converts 0..1 RGBA to 0xRRGGBB', () => {
  expect(toPixiColor([1, 0, 0, 1])).toBe(0xff0000)
  expect(toPixiColor([0, 0, 0, 0.5])).toBe(0x000000)
  expect(toPixiColor([0.2, 0.7, 1, 1])).toBe(0x33b3ff)
})

test('pixiStroke keeps world-unit width, divides screen-pixel width by zoom', () => {
  expect(pixiStroke(line, 2)).toEqual({ width: 4, color: 0xff0000, alpha: 1 })
  expect(pixiStroke({ ...line, worldWidth: false }, 2).width).toBe(2)
})

test('drawEdgesPixi applies the shared viewport and one Graphics per edge', () => {
  const calls = []
  class Graphics {
    setStrokeStyle(s) {
      calls.push(['setStrokeStyle', s])
    }
    moveTo(x, y) {
      calls.push(['moveTo', x, y])
    }
    bezierCurveTo(a, b, c, d, e, f) {
      calls.push(['bezier', a, b, c, d, e, f])
    }
    stroke() {
      calls.push(['stroke'])
    }
  }
  const layer = {
    x: -1,
    y: -1,
    zoom: -1,
    children: [],
    scale: {
      set(z) {
        layer.zoom = z
      },
    },
    removeChildren() {
      layer.children = []
    },
    addChild(c) {
      layer.children.push(c)
    },
  }
  const edges = [line, { ...line, x0: 7, y0: 8, worldWidth: false }]
  drawEdgesPixi(layer, edges, { panX: 10, panY: -4, zoom: 3 }, Graphics)

  expect(layer.x).toBe(10)
  expect(layer.y).toBe(-4)
  expect(layer.zoom).toBe(3)
  expect(layer.children.length).toBe(2)
  expect(calls[0]).toEqual(['setStrokeStyle', { width: 4, color: 0xff0000, alpha: 1 }])
  expect(calls[1]).toEqual(['moveTo', 0, 0])
  expect(calls[2]).toEqual(['bezier', 1 / 3, 0, 2 / 3, 0, 1, 0])
  // the path must be committed — without .stroke() PixiJS draws nothing
  expect(calls[3]).toEqual(['stroke'])
  expect(calls[4]).toEqual(['setStrokeStyle', { width: 4 / 3, color: 0xff0000, alpha: 1 }])
  expect(calls[7]).toEqual(['stroke'])
})

test('lineEdge is a degenerate cubic: exact midpoint and constant tangent', () => {
  const e = lineEdge(2, 1, 8, 7) // direction (6, 6)
  expectVec(sampleCubic(e, 0.5), 5, 4)
  expectVec(sampleTangent(e, 0), 6, 6)
  expectVec(sampleTangent(e, 1), 6, 6)
})

test('circleEdges close the loop: shared endpoints and near-constant radius', () => {
  const c = circleEdges(0, 0, 1, 4)
  expect(c.length).toBe(4)
  expect(c[0].x0).toBe(1)
  expect(c[0].y0).toBe(0)
  for (let i = 0; i < 4; i++) {
    const a = c[i]
    const b = c[(i + 1) % 4]
    // floating-point trig: seams match to well under a ulp, not bit-exactly
    expect(Math.abs(a.x1 - b.x0)).toBeLessThan(1e-14)
    expect(Math.abs(a.y1 - b.y0)).toBeLessThan(1e-14)
  }
  // every sampled point stays within ~0.03% of the radius
  for (const edge of c) {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const [x, y] = sampleCubic(edge, t)
      expect(Math.abs(Math.hypot(x, y) - 1)).toBeLessThan(5e-4)
    }
  }
})

test('circleEdges rejects invalid segment counts', () => {
  expect(() => circleEdges(0, 0, 1, 0)).toThrow()
  expect(() => circleEdges(0, 0, 1, 2.5)).toThrow()
})

test('polygonEdges chains degenerate cubics and closes by default', () => {
  const sq = polygonEdges([
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ])
  expect(sq.length).toBe(4)
  // the first side is exactly the bottom edge, midpoint at (0.5, 0)
  expectVec(sampleCubic(sq[0], 0.5), 0.5, 0)
  // the last side runs back to the first point
  expect(sq[3].x1).toBe(sq[0].x0)
  expect(sq[3].y1).toBe(sq[0].y0)
  // every side's control points are collinear with the side
  for (const e of sq) {
    const cross = (e.cx0 - e.x0) * (e.y1 - e.y0) - (e.cy0 - e.y0) * (e.x1 - e.x0)
    expect(cross).toBe(0)
  }
})

test('mixed shapes share one batch: packing, picking, and ordering', () => {
  const lineE = lineEdge(0, 0, 10, 0, { color: [1, 0, 0, 1], width: 2 })
  const circle = circleEdges(0, 0, 5, 4, { color: [0, 0, 1, 1], width: 2 })
  const square = polygonEdges(
    [
      [2, 2],
      [3, 2],
      [3, 3],
      [2, 3],
    ],
    { color: [0, 1, 0, 1], width: 2 },
  )
  const all = [lineE, ...circle, ...square]
  // one flat buffer for the whole mixed batch
  expect(packEdges(all).length).toBe(all.length * 16)

  const pick = (wx, wy) => {
    const [sx, sy] = worldToScreen(wx, wy, 0, 0, 1)
    return pickEdge(all, sx, sy, 0, 0, 1, 24, 0) // radiusPx 0 -> exact stroke pick
  }
  // a point on the MIDDLE of the first arc (unambiguous: no seam, no ties)
  const mid = sampleCubic(circle[0], 0.5)
  expect(pick(mid[0], mid[1])).toBe(circle[0])
  expect(pick(3, 2.5)).toBe(square[1]) // right side of the square
  expect(pick(2.5, -1)).toBe(lineE) // 1 world from the line = its rendered half width
  expect(pick(-2, 0)).toBeNull() // off every stroke
})

test('shape helpers pass worldWidth: false through to the buffer', () => {
  expect(packEdges([lineEdge(0, 0, 1, 0, { worldWidth: false })])[13]).toBe(0)
  expect(packEdges([circleEdges(0, 0, 1, 4, { worldWidth: false })[0]])[13]).toBe(0)
  expect(
    packEdges([
      polygonEdges([
        [0, 0],
        [1, 0],
      ])[0],
    ])[13],
  ).toBe(1)
})
