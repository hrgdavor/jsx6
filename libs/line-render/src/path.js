/**
 * Conversion between nodditor's connector path strings (`M x y C ...`) and
 * `Edge` data, plus the nodditor connector formula itself.
 */

const PATH_RE =
  /^M\s*([-+.\deE]+)\s+([-+.\deE]+)\s+C\s*([-+.\deE]+)\s+([-+.\deE]+)\s+([-+.\deE]+)\s+([-+.\deE]+)\s+([-+.\deE]+)\s+([-+.\deE]+)$/

/**
 * Parse a single-cubic-segment SVG path (`M x0 y0 C cx0 cy0 cx1 cy1 x1 y1`).
 *
 * This is exactly the format `makeLineConnector` in apps/nodditor produces and
 * what a `d` attribute of a connector path holds.
 *
 * `worldWidth: false` is carried through (screen-pixel width) and left off
 * otherwise, matching the `Edge` contract and `lineEdge`/`circleEdges`: an
 * absent flag means the default world-unit width. It used to be dropped, which
 * silently turned every parsed screen-pixel edge into a zoom-scaled one.
 *
 * @param {string} d
 * @param {{color?: number[], width?: number, worldWidth?: boolean}} [opts]
 * @returns {import('./curve.js').Edge}
 */
export function parseLinePath(d, { color = [0.2, 0.7, 1, 1], width = 1, worldWidth } = {}) {
  const m = PATH_RE.exec(d.trim())
  if (!m) throw new Error(`not a single M/C cubic segment: ${d}`)
  const [x0, y0, cx0, cy0, cx1, cy1, x1, y1] = m.slice(1).map(Number)
  return {
    x0,
    y0,
    cx0,
    cy0,
    cx1,
    cy1,
    x1,
    y1,
    color,
    width,
    ...(worldWidth === false ? { worldWidth: false } : {}),
  }
}

/**
 * Serialize an edge back to an SVG `d` string.
 *
 * @param {import('./curve.js').Edge} edge
 * @returns {string}
 */
export function edgeToPath(edge) {
  return `M${edge.x0} ${edge.y0} C${edge.cx0} ${edge.cy0} ${edge.cx1} ${edge.cy1} ${edge.x1} ${edge.y1}`
}

/**
 * Build a connector path between two points with the nodditor control-point
 * formula: horizontal tangents, `strength` clamped to half the point distance.
 *
 * @param {number[]} p1 - [x, y]
 * @param {number[]} p2 - [x, y]
 * @param {number} strength
 * @returns {string}
 */
export function makeConnector(p1, p2, strength) {
  const [x0, y0] = p1
  const [x1, y1] = p2
  strength = Math.min(strength, Math.hypot(x0 - x1, y0 - y1) / 2)
  return `M${x0} ${y0} C${x0 + strength} ${y0} ${x1 - strength} ${y1} ${x1} ${y1}`
}
