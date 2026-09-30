/**
 * Build geometric shapes as lists of `Edge`s (one cubic Bezier each) so the
 * same batch renderer and shader draw them unchanged: straight lines are
 * degenerate cubic Beziers (control points collinear on the line), circle
 * outlines are N cubic arcs with the standard Bezier-circle control offset
 *
 *     kappa = (4/3) * tan(pi / (2N))    (0.55228475... for N = 4)
 *
 * A four-arc circle has a maximum radial error below one part in a thousand
 * (see Wikipedia, "Bezier curve", composite Bezier curves). Shapes built here
 * feed `LineRenderer.render(edges)`, `packEdges` and `pickEdge` directly:
 * one buffer, one draw call, no new pipeline.
 */

/**
 * A straight segment as a degenerate cubic Bezier edge: control points at
 * 1/3 and 2/3 along the segment. The curve is exact (the tangent is the
 * constant (x1 - x0, y1 - y0)), so the strip renders as an exact rectangle
 * and `pickEdge` reduces to an exact segment distance.
 *
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {{color?: number[], width?: number, worldWidth?: boolean}} [opts]
 * @returns {import('./curve.js').Edge}
 */
export function lineEdge(x0, y0, x1, y1, { color = [1, 1, 1, 1], width = 1, worldWidth } = {}) {
  const dx = x1 - x0
  const dy = y1 - y0
  return {
    x0,
    y0,
    cx0: x0 + dx / 3,
    cy0: y0 + dy / 3,
    cx1: x0 + (2 * dx) / 3,
    cy1: y0 + (2 * dy) / 3,
    x1,
    y1,
    color,
    width,
    ...(worldWidth === false ? { worldWidth: false } : {}),
  }
}

/**
 * A full circle OUTLINE as `segments` cubic arcs (default 4), one edge each.
 * Adjacent arcs share their endpoints AND their tangents, so the triangle
 * strips meet cleanly at the seams — no visible gap or overlap.
 *
 * @param {number} cx - center x in world units
 * @param {number} cy - center y in world units
 * @param {number} r - radius in world units
 * @param {number} [segments = 4] - number of cubic arcs, positive integer
 * @param {{color?: number[], width?: number, worldWidth?: boolean}} [opts]
 * @returns {import('./curve.js').Edge[]}
 */
export function circleEdges(cx, cy, r, segments = 4, { color = [1, 1, 1, 1], width = 1, worldWidth } = {}) {
  if (!Number.isInteger(segments) || segments < 1) {
    throw new Error('segments must be a positive integer')
  }
  const kappa = (4 / 3) * Math.tan(Math.PI / (2 * segments))
  /** @type {import('./curve.js').Edge[]} */
  const edges = []
  for (let i = 0; i < segments; i++) {
    const a0 = (2 * Math.PI * i) / segments
    const a1 = (2 * Math.PI * (i + 1)) / segments
    const x0 = cx + r * Math.cos(a0)
    const y0 = cy + r * Math.sin(a0)
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    // unit tangent at angle a is (-sin a, cos a); c0 = p0 + k, c1 = p1 - k
    edges.push({
      x0,
      y0,
      cx0: x0 - kappa * r * Math.sin(a0),
      cy0: y0 + kappa * r * Math.cos(a0),
      cx1: x1 + kappa * r * Math.sin(a1),
      cy1: y1 - kappa * r * Math.cos(a1),
      x1,
      y1,
      color,
      width,
      ...(worldWidth === false ? { worldWidth: false } : {}),
    })
  }
  return edges
}

/**
 * A polygon OUTLINE as a chain of degenerate cubic edges — one per side.
 * `close = true` (the default) makes the last side run back to the first
 * point, closing the loop.
 *
 * Corner caveat: each strip ends in a flat cap perpendicular to its own
 * tangent, so a polygon corner is a small notch rather than a miter or round
 * join. Invisible at connector-like widths, visible on wide strokes.
 *
 * @param {number[][]} points - vertex list of [x, y] in world units
 * @param {{color?: number[], width?: number, worldWidth?: boolean, close?: boolean}} [opts]
 * @returns {import('./curve.js').Edge[]}
 */
export function polygonEdges(points, { color = [1, 1, 1, 1], width = 1, worldWidth, close = true } = {}) {
  if (points.length < 2) throw new Error('polygonEdges needs at least two points')
  const n = close ? points.length : points.length - 1
  /** @type {import('./curve.js').Edge[]} */
  const edges = []
  for (let i = 0; i < n; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % points.length]
    const dx = x1 - x0
    const dy = y1 - y0
    edges.push({
      x0,
      y0,
      cx0: x0 + dx / 3,
      cy0: y0 + dy / 3,
      cx1: x0 + (2 * dx) / 3,
      cy1: y0 + (2 * dy) / 3,
      x1,
      y1,
      color,
      width,
      ...(worldWidth === false ? { worldWidth: false } : {}),
    })
  }
  return edges
}
