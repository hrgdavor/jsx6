/**
 * Pure math for cubic Bezier curves and picking.
 *
 * Everything here works in WORLD space (the coordinates a node editor stores)
 * unless a function says otherwise. An "edge" is one cubic Bezier segment —
 * exactly the `M x0 y0 C cx0 cy0 cx1 cy1 x1 y1` string nodditor builds in
 * `makeLineConnector` — so the math and the GPU renderer agree by construction.
 */

/**
 * The GEOMETRY of one cubic Bezier edge, in world coordinates: the 8 numbers every
 * shape builder computes (`connectorEdge`, `lineEdge`, `circleEdges`, ...). `Edge`
 * is this plus the stroke style, so a builder that does not decide a colour can
 * still return a precisely typed shape.
 *
 * @typedef {object} EdgeGeometry
 * @property {number} x0 - start point x
 * @property {number} y0 - start point y
 * @property {number} cx0 - first control point x
 * @property {number} cy0 - first control point y
 * @property {number} cx1 - second control point x
 * @property {number} cy1 - second control point y
 * @property {number} x1 - end point x
 * @property {number} y1 - end point y
 */

/**
 * A cubic Bezier edge in world coordinates, with the style a renderer needs:
 * `color` is RGBA 0..1 and `width` is the stroke width — WORLD units by default
 * (thickness scales with zoom), SCREEN pixels when `worldWidth` is false.
 *
 * `points` and `pointsBox` are OPTIONAL caches of this shape
 * (`sampleEdgePoints` / `polylineBounds`), in WORLD coordinates: `pickEdge` walks
 * `points` instead of sampling the curve again and rejects on `pointsBox` before
 * anything else, so a caller that caches geometry per shape pays the curve math once
 * per change instead of once per pick. Pan and zoom never invalidate them — picking
 * converts the POINTER into this space, not the other way around.
 *
 * @typedef {EdgeGeometry & {
 *   color: number[],
 *   width: number,
 *   worldWidth?: boolean,
 *   points?: Float64Array,
 *   pointsBox?: number[],
 * }} Edge
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
 * Sample a cubic edge into a flat polyline — the geometry hit detection walks and
 * the cheapest thing to cache per shape.
 *
 * The result is a `Float64Array` of `[x0, y0, x1, y1, ...]` pairs in WORLD
 * coordinates: allocate once per shape and reuse it for every pick, at any pan and
 * zoom (`pickEdge` converts the pointer into this space instead of rebuilding the
 * points). `segments = 24` is the sampling `edgeDistance` uses, and stays accurate
 * to well under a pixel for curves the size of editor connectors.
 *
 * @param {Edge} edge
 * @param {number} [segments = 24]
 * @returns {Float64Array}
 */
export function sampleEdgePoints(edge, segments = 24) {
  const points = new Float64Array((segments + 1) * 2)
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const u = 1 - t
    const uu = u * u
    const tt = t * t
    points[i * 2] = uu * u * edge.x0 + 3 * uu * t * edge.cx0 + 3 * u * tt * edge.cx1 + tt * t * edge.x1
    points[i * 2 + 1] = uu * u * edge.y0 + 3 * uu * t * edge.cy0 + 3 * u * tt * edge.cy1 + tt * t * edge.y1
  }
  return points
}

/**
 * Axis-aligned bounds of a polyline from `sampleEdgePoints`, as
 * `[minX, minY, maxX, maxY]` — the box `pickEdge` rejects on.
 *
 * @param {Float64Array|number[]} points
 * @returns {number[]}
 */
export function polylineBounds(points) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i]
    const y = points[i + 1]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return [minX, minY, maxX, maxY]
}

/**
 * Distance from a point to a polyline from `sampleEdgePoints`.
 *
 * Walks every segment: the minimum is exact for that polyline, which is what makes
 * the result usable for RANKING edges (the closest candidate wins). An early exit
 * would not be: stopping at the first sample within the pick band can overstate
 * this edge's distance and hand the pick to a farther one, so the only pruning here
 * is the caller's AABB reject.
 *
 * @param {Float64Array|number[]} points
 * @param {number} px
 * @param {number} py
 * @returns {number}
 */
export function distToPolyline(points, px, py) {
  let min = Infinity
  let x0 = points[0]
  let y0 = points[1]
  for (let i = 2; i < points.length; i += 2) {
    const x1 = points[i]
    const y1 = points[i + 1]
    const d = distToSegment(px, py, x0, y0, x1, y1)
    if (d < min) min = d
    x0 = x1
    y0 = y1
  }
  return min
}

/**
 * Pick the edge under a screen-space point.
 *
 * The click is converted to world space; each curve is sampled and the distance
 * from the point to the sampled polyline is compared against a threshold defined
 * in SCREEN pixels — the larger of `halfWidthPx` and `radiusPx` — converted to
 * world space by `1 / zoom`. `halfWidthPx` is the edge's rendered half width in
 * screen pixels: `width / 2` when `worldWidth` is false, `width * zoom / 2` for
 * the default world-unit width. So `radiusPx = 0` gives an EXACT pick (only on
 * the rendered stroke), while any `radiusPx > 0` adds a thickness-independent
 * tolerance — easier picking of thin lines in a graph. The pick area tracks the
 * rendered stroke width in either mode, so picking stays accurate while panning
 * and zooming.
 *
 * An edge carrying a cached `points` polyline (`sampleEdgePoints`) is walked
 * instead of re-sampled, and an edge carrying `pointsBox` is rejected on that box
 * before anything else is touched — so a caller that caches geometry per shape
 * pays the curve math once per change, and a pick costs a few comparisons per
 * edge. Both caches are in WORLD coordinates, so pan and zoom never invalidate
 * them.
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
 * @param {number} [radiusPx = 5] - minimum pick radius in screen pixels; the
 *   per-edge pick radius is the LARGER of the edge's rendered half-width and
 *   `radiusPx` (`radiusPx = 0` → exact pick, only on the stroke)
 * @returns {Edge|null}
 */
export function pickEdge(edges, screenX, screenY, panX = 0, panY = 0, zoom = 1, samples = 24, radiusPx = 5) {
  const [wx, wy] = screenToWorld(screenX, screenY, panX, panY, zoom)
  /** @type {Edge|null} */
  let best = null
  let bestDist = Infinity
  for (const edge of edges) {
    const halfWidthPx = edge.worldWidth === false ? edge.width / 2 : (edge.width * zoom) / 2
    const threshold = Math.max(halfWidthPx, radiusPx) / zoom
    const box = edge.pointsBox
    if (
      box &&
      (wx < box[0] - threshold ||
        wx > box[2] + threshold ||
        wy < box[1] - threshold ||
        wy > box[3] + threshold)
    ) {
      continue
    }
    const d = edge.points ? distToPolyline(edge.points, wx, wy) : edgeDistance(edge, wx, wy, samples)
    if (d <= threshold && d < bestDist) {
      best = edge
      bestDist = d
    }
  }
  return best
}

/**
 * Pack edges into the 16-float-per-edge layout the WGSL shader expects
 * (float index in brackets): x0 y0 cx0 cy0 cx1 cy1 x1 y1 r g b a width (12)
 * worldWidth (13) pad (14, 15). `worldWidth` sits at float 13 because the
 * WGSL struct lays `width` and `worldWidth` back-to-back after the 16-aligned
 * `color` (bytes 48..52, 52..56); the 64-byte stride is unchanged.
 *
 * `out` is an optional scratch buffer to pack into. When it holds at least
 * `edges.length * 16` floats it is reused and returned, so a render loop can
 * keep ONE array alive instead of allocating a fresh one per frame; otherwise
 * an exactly sized array is allocated (an empty batch always returns a fresh
 * empty array). Only the live prefix is written — a caller that reuses a larger
 * buffer must hand the GPU just that prefix
 * (`out.subarray(0, edges.length * 16)`), because `writeBuffer` uploads the
 * whole view it is given.
 *
 * @param {Edge[]} edges
 * @param {Float32Array} [out]
 * @returns {Float32Array}
 */
export function packEdges(edges, out) {
  const needed = edges.length * 16
  const dest = needed > 0 && out && out.length >= needed ? out : new Float32Array(needed)
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]
    const o = i * 16
    dest[o] = e.x0
    dest[o + 1] = e.y0
    dest[o + 2] = e.cx0
    dest[o + 3] = e.cy0
    dest[o + 4] = e.cx1
    dest[o + 5] = e.cy1
    dest[o + 6] = e.x1
    dest[o + 7] = e.y1
    const c = e.color
    dest[o + 8] = c[0]
    dest[o + 9] = c[1]
    dest[o + 10] = c[2]
    dest[o + 11] = c[3]
    dest[o + 12] = e.width
    dest[o + 13] = e.worldWidth === false ? 0 : 1
    // o + 14 and o + 15 stay zero (pad)
  }
  return dest
}
