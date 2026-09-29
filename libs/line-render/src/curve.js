/**
 * Pure math for cubic Bezier curves and picking.
 *
 * Everything here works in WORLD space (the coordinates a node editor stores)
 * unless a function says otherwise. An "edge" is one cubic Bezier segment —
 * exactly the `M x0 y0 C cx0 cy0 cx1 cy1 x1 y1` string nodditor builds in
 * `makeLineConnector` — so the math and the GPU renderer agree by construction.
 */

/**
 * A cubic Bezier edge in world coordinates.
 *
 * @typedef {object} Edge
 * @property {number} x0 - start point x
 * @property {number} y0 - start point y
 * @property {number} cx0 - first control point x
 * @property {number} cy0 - first control point y
 * @property {number} cx1 - second control point x
 * @property {number} cy1 - second control point y
 * @property {number} x1 - end point x
 * @property {number} y1 - end point y
 * @property {number[]} color - RGBA, 0..1
 * @property {number} width - stroke width in SCREEN pixels (zoom-independent)
 */

/**
 * Point on the cubic Bezier at parameter t in [0,1].
 *
 * @param {Edge} edge
 * @param {number} t
 * @returns {number[]} [x, y]
 */
export function sampleCubic(edge, t) {
  const u = 1 - t
  const uu = u * u
  const tt = t * t
  return [
    uu * u * edge.x0 + 3 * uu * t * edge.cx0 + 3 * u * tt * edge.cx1 + tt * t * edge.x1,
    uu * u * edge.y0 + 3 * uu * t * edge.cy0 + 3 * u * tt * edge.cy1 + tt * t * edge.y1,
  ]
}

/**
 * Derivative (tangent) of the cubic Bezier at parameter t in [0,1].
 *
 * @param {Edge} edge
 * @param {number} t
 * @returns {number[]} [dx, dy]
 */
export function sampleTangent(edge, t) {
  const u = 1 - t
  return [
    3 * u * u * (edge.cx0 - edge.x0) + 6 * u * t * (edge.cx1 - edge.cx0) + 3 * t * t * (edge.x1 - edge.cx1),
    3 * u * u * (edge.cy0 - edge.y0) + 6 * u * t * (edge.cy1 - edge.cy0) + 3 * t * t * (edge.y1 - edge.cy1),
  ]
}

/**
 * Distance from point (px, py) to the straight segment (x0, y0)-(x1, y1).
 *
 * The projection is clamped to the segment, so endpoints are handled correctly.
 *
 * @param {number} px
 * @param {number} py
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {number}
 */
export function distToSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0
  const dy = y1 - y0
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(px - x0, py - y0)
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2))
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy))
}

/**
 * Distance from a world point to a sampled cubic curve.
 *
 * The curve is sampled at `samples + 1` evenly spaced parameters and the minimum
 * point-to-segment distance over the polyline is returned — a cheap approximation
 * with no root finding. At `samples = 24` it is accurate to well under a pixel
 * for curves the size of editor connectors.
 *
 * @param {Edge} edge
 * @param {number} x - world x of the point
 * @param {number} y - world y of the point
 * @param {number} [samples]
 * @returns {number}
 */
export function edgeDistance(edge, x, y, samples = 24) {
  let min = Infinity
  let [px, py] = sampleCubic(edge, 0)
  for (let i = 1; i <= samples; i++) {
    const [cx, cy] = sampleCubic(edge, i / samples)
    const d = distToSegment(x, y, px, py, cx, cy)
    if (d < min) min = d
    px = cx
    py = cy
  }
  return min
}

/**
 * Transform a screen point to world space.
 *
 * @param {number} screenX
 * @param {number} screenY
 * @param {number} [panX]
 * @param {number} [panY]
 * @param {number} [zoom]
 * @returns {number[]} [worldX, worldY]
 */
export function screenToWorld(screenX, screenY, panX = 0, panY = 0, zoom = 1) {
  return [(screenX - panX) / zoom, (screenY - panY) / zoom]
}

/**
 * Transform a world point to screen space.
 *
 * @param {number} worldX
 * @param {number} worldY
 * @param {number} [panX]
 * @param {number} [panY]
 * @param {number} [zoom]
 * @returns {number[]} [screenX, screenY]
 */
export function worldToScreen(worldX, worldY, panX = 0, panY = 0, zoom = 1) {
  return [worldX * zoom + panX, worldY * zoom + panY]
}

/**
 * Pick the edge under a screen-space point.
 *
 * The click is converted to world space; each curve is sampled and the distance
 * from the point to the sampled polyline is compared against a threshold defined
 * in SCREEN pixels — `width / 2 + radiusPx` — converted to world space by
 * `1 / zoom`. The pick area therefore tracks the rendered, zoom-independent
 * stroke width, so picking stays accurate while panning and zooming.
 *
 * When several edges are within the threshold, the closest one wins (ties
 * resolve to the earlier edge in the array).
 *
 * @param {Edge[]} edges
 * @param {number} screenX - in the same space as the canvas backing store
 * @param {number} screenY
 * @param {number} [panX]
 * @param {number} [panY]
 * @param {number} [zoom] - must be > 0
 * @param {number} [samples]
 * @param {number} [radiusPx] - pick radius beyond half the stroke, in screen pixels
 * @returns {Edge|null}
 */
export function pickEdge(edges, screenX, screenY, panX = 0, panY = 0, zoom = 1, samples = 24, radiusPx = 5) {
  const [wx, wy] = screenToWorld(screenX, screenY, panX, panY, zoom)
  /** @type {Edge|null} */
  let best = null
  let bestDist = Infinity
  for (const edge of edges) {
    const threshold = (edge.width / 2 + radiusPx) / zoom
    const d = edgeDistance(edge, wx, wy, samples)
    if (d <= threshold && d < bestDist) {
      best = edge
      bestDist = d
    }
  }
  return best
}

/**
 * Pack edges into the 16-float-per-edge layout the WGSL shader expects:
 * `x0 y0 cx0 cy0 cx1 cy1 x1 y1 r g b a width 0 0 0`.
 *
 * @param {Edge[]} edges
 * @returns {Float32Array}
 */
export function packEdges(edges) {
  const out = new Float32Array(edges.length * 16)
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]
    const o = i * 16
    out[o] = e.x0
    out[o + 1] = e.y0
    out[o + 2] = e.cx0
    out[o + 3] = e.cy0
    out[o + 4] = e.cx1
    out[o + 5] = e.cy1
    out[o + 6] = e.x1
    out[o + 7] = e.y1
    const c = e.color
    out[o + 8] = c[0]
    out[o + 9] = c[1]
    out[o + 10] = c[2]
    out[o + 11] = c[3]
    out[o + 12] = e.width
    // o + 13..15 stay zero (pad)
  }
  return out
}
