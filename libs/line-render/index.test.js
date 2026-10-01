import { expect, test } from 'bun:test'

import {
  circleEdges,
  connectorEdge,
  distToPolyline,
  distToSegment,
  drawEdgesPixi,
  drawEdgesTwo,
  edgeAnchors,
  edgeDistance,
  edgeToPath,
  lineEdge,
  LineRenderer,
  makeConnector,
  packEdges,
  parseLinePath,
  pickEdge,
  pixiStroke,
  polygonEdges,
  polylineBounds,
  sampleCubic,
  sampleEdgePoints,
  sampleTangent,
  screenToWorld,
  toPixiColor,
  toTwoColor,
  twoStroke,
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

test('parseLinePath carries worldWidth: false through to the packed buffer', () => {
  const d = 'M0 0 C10 0 20 10 30 10'
  const px = parseLinePath(d, { width: 2, worldWidth: false })
  expect(px.worldWidth).toBe(false)
  expect(packEdges([px])[13]).toBe(0)
  // omitting the flag is the world-unit default — it is only recorded when false
  expect('worldWidth' in parseLinePath(d)).toBe(false)
  expect(packEdges([parseLinePath(d, { worldWidth: true })])[13]).toBe(1)
})

test('packEdges reuses a scratch buffer and only writes the live prefix', () => {
  const scratch = new Float32Array(48)
  const two = [line, { ...line, x0: 7, y0: 8 }]
  const packed = packEdges(two, scratch)
  expect(packed).toBe(scratch) // reused, not reallocated
  expect(packed[16]).toBe(7)
  expect(packed[17]).toBe(8)
  // too small for the batch: an exactly sized array is allocated instead
  const small = new Float32Array(16)
  const fresh = packEdges(two, small)
  expect(fresh).not.toBe(small)
  expect(fresh.length).toBe(32)
  expect(fresh[16]).toBe(7)
  expect(packEdges([], scratch).length).toBe(0)
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

test('connectorEdge is the data form of makeConnector', () => {
  const e = connectorEdge([0, 0], [100, 50], 40)
  expect(e).toEqual({ x0: 0, y0: 0, cx0: 40, cy0: 0, cx1: 60, cy1: 50, x1: 100, y1: 50 })
  expect(edgeToPath(e)).toBe(makeConnector([0, 0], [100, 50], 40))
  // clamped exactly like the string form
  expect(connectorEdge([0, 0], [10, 0], 999)).toEqual({
    x0: 0,
    y0: 0,
    cx0: 5,
    cy0: 0,
    cx1: 5,
    cy1: 0,
    x1: 10,
    y1: 0,
  })
})

test('sampleEdgePoints/polylineBounds/distToPolyline describe the sampled curve', () => {
  const e = connectorEdge([0, 0], [100, 50], 40)
  const points = sampleEdgePoints(e, 4)
  expect(points).toBeInstanceOf(Float64Array)
  expect(points.length).toBe(10) // (segments + 1) pairs
  // the polyline starts and ends on the curve's endpoints
  expect([points[0], points[1]]).toEqual([0, 0])
  expect([points[8], points[9]]).toEqual([100, 50])
  const box = polylineBounds(points)
  // every sampled point is inside the box, and the endpoints touch its corners
  expect(box[0]).toBe(0)
  expect(box[3]).toBe(50)
  for (let i = 0; i < points.length; i += 2) {
    expect(points[i]).toBeGreaterThanOrEqual(box[0])
    expect(points[i]).toBeLessThanOrEqual(box[2])
    expect(points[i + 1]).toBeGreaterThanOrEqual(box[1])
    expect(points[i + 1]).toBeLessThanOrEqual(box[3])
  }
  // a point ON the polyline is at distance 0, a far one is far
  const mid = [points[2], points[3]]
  expect(distToPolyline(points, mid[0], mid[1])).toBeCloseTo(0)
  expect(distToPolyline(points, 0, 500)).toBeGreaterThan(400)
})

test('pickEdge over cached points+box returns exactly what sampling returns', () => {
  // deterministic PRNG so a failure is reproducible
  let seed = 123456789
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const edges = []
  for (let i = 0; i < 40; i++) {
    const e = connectorEdge([rnd() * 400, rnd() * 300], [rnd() * 400, rnd() * 300], 60)
    e.color = [0, 0, 0, 1]
    e.width = 2
    e.worldWidth = false
    e.id = i
    edges.push(e)
  }
  // the same edges, with the geometry every caller of sampleEdgePoints would cache
  const cached = edges.map(e => {
    const points = sampleEdgePoints(e, 24)
    return { ...e, points, pointsBox: polylineBounds(points) }
  })
  for (let i = 0; i < 400; i++) {
    const sx = rnd() * 400
    const sy = rnd() * 300
    const zoom = 1 + rnd() * 3
    const radiusPx = i % 8 === 0 ? 0 : 4
    const sampled = pickEdge(edges, sx, sy, 0, 0, zoom, 24, radiusPx)
    const fromCache = pickEdge(cached, sx, sy, 0, 0, zoom, 24, radiusPx)
    expect(fromCache?.id ?? null).toBe(sampled?.id ?? null)
  }
  // and the box actually prunes: a point far from every box picks nothing
  expect(pickEdge(cached, 5000, 5000, 0, 0, 1, 24, 4)).toBeNull()
})

test('pickEdge tolerates a cached polyline without a cached box', () => {
  const e = connectorEdge([0, 0], [100, 0], 40)
  e.color = [0, 0, 0, 1]
  e.width = 2
  e.worldWidth = false
  const points = sampleEdgePoints(e, 24)
  const noBox = { ...e, points }
  expect(pickEdge([noBox], 50, 0, 0, 0, 1, 24, 4)).toBe(noBox)
  expect(pickEdge([noBox], 50, 400, 0, 0, 1, 24, 4)).toBeNull()
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

/** Minimal stand-in for the Two.js namespace: records Anchor and Path construction. */
function mockTwo() {
  const anchors = []
  const paths = []
  class Anchor {
    constructor(x, y, ax, ay, bx, by, command) {
      this.x = x
      this.y = y
      this.ax = ax
      this.ay = ay
      this.bx = bx
      this.by = by
      this.command = command
      anchors.push(this)
    }
  }
  class Path {
    constructor(vertices, closed, curved, manual) {
      this.vertices = vertices
      this.closed = closed
      this.curved = curved
      this.manual = manual
      this.fill = '#fff'
      this.stroke = '#000'
      this.linewidth = 1
      this.opacity = 1
      this.strokeAttenuation = true
      paths.push(this)
    }
  }
  const Commands = { move: 'M', line: 'L', curve: 'C', arc: 'A', close: 'Z' }
  return { Two: { Anchor, Path, Types: { svg: 'SVGRenderer' }, Commands }, anchors, paths }
}

test('toTwoColor converts 0..1 RGBA to a #RRGGBB string', () => {
  expect(toTwoColor([1, 0, 0, 1])).toBe('#ff0000')
  expect(toTwoColor([0, 0, 0, 0.5])).toBe('#000000')
  expect(toTwoColor([0.2, 0.7, 1, 1])).toBe('#33b3ff')
})

test('twoStroke keeps world-unit width, flags screen-pixel width for Two.js', () => {
  expect(twoStroke(line)).toEqual({
    color: '#ff0000',
    width: 4,
    opacity: 1,
    strokeAttenuation: true,
  })
  // worldWidth false -> Two.js compensates internally (strokeAttenuation: false)
  expect(twoStroke({ ...line, worldWidth: false })).toEqual({
    color: '#ff0000',
    width: 4,
    opacity: 1,
    strokeAttenuation: false,
  })
})

test('edgeAnchors maps the edge to relative-handle anchors', () => {
  const { Two } = mockTwo()
  const [a0, a1] = edgeAnchors(line, Two)
  // start anchor: outgoing control relative to the point
  expect(a0.x).toBe(0)
  expect(a0.y).toBe(0)
  expect(a0.ax).toBe(0)
  expect(a0.ay).toBe(0)
  expect(a0.bx).toBeCloseTo(1 / 3) // cx0 - x0
  expect(a0.by).toBe(0)
  expect(a0.command).toBeUndefined() // default 'move'
  // end anchor: incoming control relative to the point, command Two.Commands.curve ('C')
  expect(a1.x).toBe(1)
  expect(a1.y).toBe(0)
  expect(a1.ax).toBeCloseTo(2 / 3 - 1) // cx1 - x1
  expect(a1.ay).toBe(0)
  expect(a1.bx).toBe(0)
  expect(a1.by).toBe(0)
  expect(a1.command).toBe('C')
})

test('drawEdgesTwo applies the shared viewport and one Path per edge', () => {
  const { Two, anchors } = mockTwo()
  const group = {
    position: { x: -1, y: -1 },
    scale: -1,
    children: [],
    add(c) {
      group.children.push(c)
    },
    remove(arr) {
      group.children = group.children.filter(c => !arr.includes(c))
    },
  }
  const edges = [line, { ...line, x0: 7, y0: 8, worldWidth: false }]
  drawEdgesTwo(group, edges, { panX: 10, panY: -4, zoom: 2 }, Two)

  expect(group.position.x).toBe(10)
  expect(group.position.y).toBe(-4)
  expect(group.scale).toBe(2)
  expect(group.children.length).toBe(2)
  expect(anchors.length).toBe(4) // two anchors per edge

  const [p0, p1] = group.children
  expect(p0.fill).toBe('none') // stroke only, never a fill
  expect(p0.stroke).toBe('#ff0000')
  expect(p0.linewidth).toBe(4)
  expect(p0.opacity).toBe(1)
  expect(p0.strokeAttenuation).toBe(true) // world-unit width scales with zoom
  expect(p0.closed).toBe(false)
  expect(p0.curved).toBe(false)
  expect(p0.manual).toBe(true) // manual: Two keeps the given anchors verbatim
  expect(p0.vertices[0]).toBe(anchors[0])
  expect(p0.vertices[1]).toBe(anchors[1])
  expect(p1.strokeAttenuation).toBe(false) // screen-pixel width, Two compensates

  // re-draw replaces the children, never accumulates
  drawEdgesTwo(group, edges, { panX: 1, panY: 1, zoom: 1 }, Two)
  expect(group.children.length).toBe(2)
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

// ---------- LineRenderer, against a fake WebGPU device ----------
//
// There is no GPU (and no happy-dom) in this package's test run, so the renderer
// is driven through a recorded fake: the members it touches are stubbed, and the
// assertions are about the bookkeeping a real device cannot show anyway — the
// upload size of a frame, the lifetime of a buffer/bind group, and teardown.

/**
 * A fake `navigator.gpu` + canvas that records what `LineRenderer` asks for.
 *
 * `makeDevice()` hands out another device (several renderers can share one, which
 * is what the borrowed-device tests do) and `lose(info)` resolves the `lost`
 * promise every fake device shares (as `destroy()` does too).
 */
function fakeGpu() {
  let resolveLost
  const lost = new Promise(resolve => (resolveLost = resolve))
  const calls = {
    adapters: 0,
    devices: 0,
    bindGroups: 0,
    buffers: [],
    writes: [],
    draws: [],
    destroyed: [],
    unconfigured: 0,
  }
  const makeDevice = () => {
    calls.devices++
    const device = {
      queue: {
        writeBuffer(buffer, offset, data) {
          calls.writes.push({ buffer, offset, data })
        },
        submit() {},
      },
      lost,
      destroy() {
        calls.destroyed.push(device)
        resolveLost({ reason: 'destroyed', message: 'destroyed' })
      },
      createShaderModule: () => ({}),
      createRenderPipeline: () => ({ getBindGroupLayout: () => ({}) }),
      createBuffer: descriptor => {
        const buffer = { descriptor, destroy() {} }
        calls.buffers.push(buffer)
        return buffer
      },
      createTexture: () => ({ createView: () => ({}), destroy() {} }),
      createBindGroup: () => {
        calls.bindGroups++
        return {}
      },
      createSampler: () => ({}),
      createCommandEncoder: () => ({
        beginRenderPass: () => ({
          setPipeline() {},
          setBindGroup() {},
          draw(vertexCount, instanceCount) {
            calls.draws.push([vertexCount, instanceCount])
          },
          end() {},
        }),
        finish: () => ({}),
      }),
    }
    return device
  }
  const canvas = {
    width: 200,
    height: 100,
    getContext: () => ({
      configure() {},
      unconfigure() {
        calls.unconfigured++
      },
      getCurrentTexture: () => ({ createView: () => ({}) }),
    }),
  }
  const gpu = {
    getPreferredCanvasFormat: () => 'bgra8unorm',
    async requestAdapter() {
      calls.adapters++
      return { requestDevice: async () => makeDevice() }
    },
  }
  return { gpu, canvas, calls, makeDevice, lose: info => resolveLost(info) }
}

/** The WebGPU usage bit flags (spec values) as `globalThis` members for the fake run. */
const GPU_USAGE_GLOBALS = {
  GPUBufferUsage: {
    MAP_READ: 1,
    MAP_WRITE: 2,
    COPY_SRC: 4,
    COPY_DST: 8,
    INDEX: 16,
    VERTEX: 32,
    UNIFORM: 64,
    STORAGE: 128,
    INDIRECT: 256,
    QUERY_RESOLVE: 512,
  },
  GPUTextureUsage: {
    COPY_SRC: 1,
    COPY_DST: 2,
    TEXTURE_BINDING: 4,
    STORAGE_BINDING: 8,
    RENDER_ATTACHMENT: 16,
  },
}

/** Run `fn` with `globalThis[name]` replaced for the duration, then restore. */
async function withGlobals(values, fn) {
  const saved = Object.entries(values).map(([name, value]) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
    value,
  ])
  for (const [name, , value] of saved)
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  try {
    return await fn()
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
}

/** Run `fn` with `navigator.gpu` (and the usage flags) replaced by a fake device. */
async function withFakeGpu(fn) {
  const fake = fakeGpu()
  const descriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'gpu')
  Object.defineProperty(globalThis.navigator, 'gpu', { value: fake.gpu, configurable: true, writable: true })
  try {
    await withGlobals(GPU_USAGE_GLOBALS, () => fn(fake))
  } finally {
    if (descriptor) Object.defineProperty(globalThis.navigator, 'gpu', descriptor)
    else delete globalThis.navigator.gpu
  }
}

/** Let the queued `device.lost` callback run. */
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

test('LineRenderer reuses one bind group and one pack scratch across frames', async () => {
  await withFakeGpu(async fake => {
    const renderer = new LineRenderer(fake.canvas, {})
    await renderer.init()
    const two = [line, { ...line, x0: 7, y0: 8 }]

    renderer.render(two)
    renderer.render(two)
    expect(fake.calls.bindGroups).toBe(1) // created once, then cached
    expect(fake.calls.draws).toEqual([
      [66, 2],
      [66, 2],
    ]) // (segmentsPerCurve + 1) * 2, instances

    // outgrow the edge buffer (it is allocated in 256-float steps): the buffer is
    // replaced, which invalidates the cached bind group
    const many = Array.from({ length: 17 }, (_, i) => ({ ...line, x0: i }))
    renderer.render(many)
    expect(fake.calls.bindGroups).toBe(2)
    const grown = fake.calls.writes.filter(w => w.buffer === renderer.edgeBuffer).at(-1)
    expect(grown.data.length).toBe(17 * 16)

    // shrinking reuses the bigger scratch but uploads only the live prefix
    renderer.render([line])
    const shrunk = fake.calls.writes.filter(w => w.buffer === renderer.edgeBuffer).at(-1)
    expect(shrunk.data.length).toBe(16)
    expect(shrunk.data[0]).toBe(0)

    renderer.dispose()
  })
})

test('LineRenderer.dispose releases the device without reporting it as a loss', async () => {
  await withFakeGpu(async fake => {
    const lost = []
    const renderer = new LineRenderer(fake.canvas, { onLost: info => lost.push(info) })
    await renderer.init()
    renderer.render([line])

    renderer.dispose()
    await tick()
    expect(fake.calls.unconfigured).toBe(1)
    expect(fake.calls.destroyed.length).toBe(1)
    expect(lost).toEqual([]) // our own teardown is not a device loss
    expect(renderer.lost).toBe(false)

    expect(() => renderer.render([line])).toThrow(/init\(\) must be called/)
    expect(() => renderer.dispose()).not.toThrow() // idempotent
  })
})

test('LineRenderer reports an external device loss once and refuses to draw', async () => {
  await withFakeGpu(async fake => {
    const lost = []
    const renderer = new LineRenderer(fake.canvas, { onLost: info => lost.push(info) })
    await renderer.init()
    renderer.render([line])

    fake.lose({ reason: 'unknown', message: 'gpu reset' })
    await tick()
    expect(lost).toEqual([{ reason: 'unknown', message: 'gpu reset' }])
    expect(renderer.lost).toBe(true)
    expect(() => renderer.render([line])).toThrow(/device was lost/)
  })
})

test('LineRenderer.init fails clearly without WebGPU', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis.navigator, 'gpu')
  Object.defineProperty(globalThis.navigator, 'gpu', { value: undefined, configurable: true, writable: true })
  try {
    const renderer = new LineRenderer({ width: 1, height: 1 }, {})
    await expect(renderer.init()).rejects.toThrow(/WebGPU is not available/)
    expect(() => renderer.dispose()).not.toThrow()
  } finally {
    Object.defineProperty(globalThis.navigator, 'gpu', {
      value: original?.value,
      configurable: true,
      writable: true,
    })
  }
})

// ---------- the host-facing capability helpers ----------

test('LineRenderer.isSupported probes navigator.gpu synchronously', async () => {
  await withFakeGpu(async () => {
    expect(LineRenderer.isSupported()).toBe(true)
  })
  // `withFakeGpu` restores the real (bun) `navigator.gpu`, which does not exist
  expect(LineRenderer.isSupported()).toBe(false)
})

test('LineRenderer.create resolves with a ready renderer', async () => {
  await withFakeGpu(async fake => {
    const renderer = await LineRenderer.create(fake.canvas, { clear: [0, 0, 0, 0] })
    expect(renderer).toBeInstanceOf(LineRenderer)
    expect(renderer.clear).toEqual([0, 0, 0, 0])
    renderer.render([line])
    expect(fake.calls.draws).toEqual([[66, 1]])
    renderer.dispose()
  })
})

test('LineRenderer.create resolves with null (and warns) when the GPU is unavailable', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'gpu')
  Object.defineProperty(globalThis.navigator, 'gpu', { value: undefined, configurable: true, writable: true })
  const warnings = []
  const realWarn = console.warn
  console.warn = msg => warnings.push(String(msg))
  try {
    const renderer = await LineRenderer.create({ width: 1, height: 1 })
    expect(renderer).toBeNull()
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toMatch(/LineRenderer\.create\(\): WebGPU is not available/)
  } finally {
    console.warn = realWarn
    Object.defineProperty(globalThis.navigator, 'gpu', {
      value: descriptor?.value,
      configurable: true,
      writable: true,
    })
  }
})

test('LineRenderer.create still throws on a usage error and releases what it acquired', async () => {
  await withFakeGpu(async fake => {
    // a bad option is a programming error, not a missing GPU: it must not be
    // reported as "no renderer available"
    await expect(LineRenderer.create(fake.canvas, { supersample: 0 })).rejects.toThrow(/positive integer/)
    expect(fake.calls.adapters).toBe(0)
  })
})

// ---------- device sharing (the borrowed `device` option) ----------

test('a borrowed device is used without requesting an adapter and survives dispose', async () => {
  await withFakeGpu(async fake => {
    const shared = fake.makeDevice()
    const renderer = new LineRenderer(fake.canvas, { device: shared })
    expect(renderer.device).toBe(shared) // readable before init
    expect(renderer.ownsDevice).toBe(false)

    await renderer.init()
    expect(fake.calls.adapters).toBe(0) // no requestAdapter()
    expect(fake.calls.devices).toBe(1) // only the device the test made
    renderer.render([line])

    renderer.dispose()
    await tick()
    expect(fake.calls.unconfigured).toBe(1) // the CONTEXT is still released
    expect(fake.calls.destroyed).toEqual([]) // ... but the device is the caller's
    expect(shared.destroy).toBeFunction()
  })
})

test('one device behind two renderers: one request, both draw, one dispose is not fatal', async () => {
  await withFakeGpu(async fake => {
    const shared = fake.makeDevice()
    const canvasB = { ...fake.canvas, getContext: fake.canvas.getContext }
    const a = await LineRenderer.create(fake.canvas, { device: shared })
    const b = await LineRenderer.create(canvasB, { device: shared })
    expect(fake.calls.adapters).toBe(0)
    expect(fake.calls.devices).toBe(1)

    a.render([line])
    b.render([line, { ...line, x0: 3 }])
    expect(fake.calls.draws).toEqual([
      [66, 1],
      [66, 2],
    ])

    // disposing one renderer releases only its own context and buffers
    a.dispose()
    expect(fake.calls.unconfigured).toBe(1)
    expect(fake.calls.destroyed).toEqual([])
    b.render([line]) // the survivor keeps drawing on the shared device
    b.dispose()
    expect(fake.calls.unconfigured).toBe(2)
  })
})

test('destroying a shared device is reported as a loss to every borrower', async () => {
  await withFakeGpu(async fake => {
    const shared = fake.makeDevice()
    const lost = []
    const renderer = await LineRenderer.create(fake.canvas, {
      device: shared,
      onLost: info => lost.push(info),
    })
    // the owner (not this renderer) destroys the device
    shared.destroy()
    await tick()
    expect(lost).toEqual([{ reason: 'destroyed', message: 'destroyed' }])
    expect(renderer.lost).toBe(true)
    expect(() => renderer.render([line])).toThrow(/device was lost/)
    renderer.dispose() // must not destroy it a second time
    expect(fake.calls.destroyed.length).toBe(1)
  })
})

test('a borrowed device works even when navigator.gpu is gone (format fallback)', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'gpu')
  Object.defineProperty(globalThis.navigator, 'gpu', { value: undefined, configurable: true, writable: true })
  try {
    const fake = fakeGpu()
    await withGlobals(GPU_USAGE_GLOBALS, async () => {
      const renderer = new LineRenderer(fake.canvas, { device: fake.makeDevice() })
      await renderer.init()
      expect(renderer.format).toBe('bgra8unorm')
      renderer.render([line])
      expect(fake.calls.draws).toEqual([[66, 1]])
      renderer.dispose()
    })
  } finally {
    Object.defineProperty(globalThis.navigator, 'gpu', {
      value: descriptor?.value,
      configurable: true,
      writable: true,
    })
  }
})
