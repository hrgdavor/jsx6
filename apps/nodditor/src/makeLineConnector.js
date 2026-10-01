/**
 * The connector's geometry as DATA — the single source of truth for a line's shape.
 *
 * Everything else about the shape is DERIVED from an edge and cached on the line
 * (`ConnectLine.svgText` / `ConnectLine.points`):
 *
 *   - `edgeToSvg(edge)` — the `d` text a `<path>` takes, written by the SVG layer;
 *   - `sampleEdgePoints(edge, segments)` — the polyline hit detection walks,
 *     written by whoever needs it (the canvas layer), in WORLD coordinates.
 *
 * Both caches are invalidated together by `ConnectLine.changed()`, which stamps a
 * new id from the process-wide sequence (`./changeSeq.js`).
 *
 * @typedef {object} LineEdge
 * @property {number} x0
 * @property {number} y0
 * @property {number} cx0
 * @property {number} cy0
 * @property {number} cx1
 * @property {number} cy1
 * @property {number} x1
 * @property {number} y1
 */

const { min, sqrt } = Math

/** Generate bezier curve that connects two points (left1,top1)--(left2,top2)
 *
 * @param {number} strength of the curve at connection point
 * @param {Array<number>} p1
 * @param {Array<number>} box1
 * @param {Array<number>} box1pos
 * @param {String} dir1
 * @param {Array<number>} p2
 * @param {Array<number>} box2
 * @param {Array<number>} box2pos
 * @param {String} dir2
 * @returns {String} path definition for the bezier
 */
export const makeLineConnector = (strength, p1, box1, box1pos, dir1, p2, box2, box2pos, dir2) =>
  edgeToSvg(connectorEdge(strength, p1, p2))

/**
 * The same connector as numeric data: a cubic Bezier with horizontal tangents and
 * `strength` clamped to half the distance between the points. This is what
 * `ConnectLine.edge` holds — the string form above exists for SVG consumers and for
 * backward compatibility.
 *
 * @param {number} strength of the curve at the connection point
 * @param {Array<number>} p1 [x, y]
 * @param {Array<number>} p2 [x, y]
 * @returns {LineEdge}
 */
export const connectorEdge = (strength, p1, p2) => {
  const [x0, y0] = p1
  const [x1, y1] = p2
  const s = min(strength, sqrt((x0 - x1) ** 2 + (y0 - y1) ** 2) / 2)
  return { x0, y0, cx0: x0 + s, cy0: y0, cx1: x1 - s, cy1: y1, x1, y1 }
}

/**
 * Serialize an edge into the `M x y C …` text a `<path d>` takes — the cached
 * `ConnectLine.svgText`.
 *
 * @param {LineEdge} edge
 * @returns {string}
 */
export const edgeToSvg = edge =>
  `M${edge.x0} ${edge.y0} C${edge.cx0} ${edge.cy0} ${edge.cx1} ${edge.cy1} ${edge.x1} ${edge.y1}`

/**
 * Sample an edge into a flat polyline of `[x0, y0, x1, y1, …]` pairs, in the same
 * (world) coordinates as the edge — the cached `ConnectLine.points`.
 *
 * This is the same math as `@jsx6/line-render`'s `sampleEdgePoints` (pinned by a
 * test in `test/lineGeometry.test.js`); it lives here as well because the line model
 * must keep working when the OPTIONAL `@jsx6/line-render` is not installed, and a
 * polyline in world coordinates stays valid across pan and zoom — picking converts
 * the POINTER into this space, never these points into screen space.
 *
 * @param {LineEdge} edge
 * @param {number} [segments = 24]
 * @returns {Float64Array}
 */
export const sampleEdgePoints = (edge, segments = 24) => {
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
 * Axis-aligned bounds of a sampled polyline, `[minX, minY, maxX, maxY]` — the box a
 * pick rejects on before walking any segment.
 *
 * @param {Float64Array|number[]} points
 * @returns {number[]}
 */
export const pointsBounds = points => {
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
