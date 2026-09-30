/**
 * PixiJS 8 bridge — draw the same edges with PixiJS.
 *
 * The edge model is deliberately shaped so a project can outgrow this library
 * into PixiJS without a rewrite; everything is a 1:1 mapping:
 *
 *   edge { x0, y0, cx0, cy0, cx1, cy1, x1, y1, color, width, worldWidth }
 *     → one Graphics stroke path:
 *         g.setStrokeStyle({ width, color: toPixiColor(color), alpha: color[3] })
 *           .moveTo(x0, y0)
 *           .bezierCurveTo(cx0, cy0, cx1, cy1, x1, y1)
 *           .stroke()
 *
 *     Note: in PixiJS 8, `moveTo`/`bezierCurveTo` only *build* the path; the
 *     stroke geometry is committed by the explicit `.stroke()` call. Without
 *     it the Graphics carries zero instructions and draws nothing (a black
 *     panel).
 *
 *   viewport  screen = world * zoom + pan
 *     → one container transform:
 *         layer.x = panX; layer.y = panY; layer.scale.set(zoom)
 *
 *   width semantics:
 *     worldWidth true  (default) — width in WORLD units. PixiJS strokes are
 *       local-space, so they scale with the container scale: thickness grows
 *       with zoom, exactly like the WebGPU and SVG panels.
 *     worldWidth false          — width in SCREEN pixels. PixiJS has no
 *       non-scaling-stroke, so divide by zoom on every zoom change.
 *
 *   Picking does not move at all: `pickEdge`, `edgeDistance` and
 *   `screenToWorld` are pure functions of (edges, viewport), so a PixiJS
 *   project keeps the exact same hover/click behavior with zero rework.
 *
 * This module has NO pixi.js import: the `Graphics` constructor is injected
 * by the caller, so the package stays dependency-free and unit-testable.
 * In an app you add `pixi.js` yourself and call `drawEdgesPixi(layer, batch, view, Graphics)`.
 */

/**
 * The minimal structural shape of the PixiJS Container that `drawEdgesPixi`
 * needs: it carries the shared viewport (x/y = pan, scale = zoom).
 *
 * @typedef {object} PixiLayer
 * @property {number} x
 * @property {number} y
 * @property {{set: (z: number) => void}} scale
 * @property {(child?: unknown) => void} removeChildren
 * @property {(child?: unknown) => void} addChild
 */

/**
 * The minimal structural shape of the PixiJS Graphics that `drawEdgesPixi`
 * needs: one stroke path per edge.
 *
 * @typedef {object} PixiGraphics
 * @property {(style: {width: number, color: number, alpha: number}) => void} setStrokeStyle
 * @property {(x: number, y: number) => void} moveTo
 * @property {(cpX: number, cpY: number, cp2X: number, cp2Y: number, endX: number, endY: number) => void} bezierCurveTo
 * @property {() => void} stroke - commits the path; without it the Graphics draws nothing
 */

/**
 * Convert a 0..1 `[r, g, b(, a)]` color to a PixiJS `0xRRGGBB` number.
 *
 * @param {number[]} color
 * @returns {number}
 */
export function toPixiColor(color) {
  const r = Math.round(color[0] * 255)
  const g = Math.round(color[1] * 255)
  const b = Math.round(color[2] * 255)
  return (r << 16) | (g << 8) | b
}

/**
 * PixiJS stroke style for one edge at a given zoom.
 *
 * World-unit edges (the default) keep `width` as-is — the container scale
 * turns it into `width * zoom` screen pixels. Screen-pixel edges are
 * divided by zoom, because PixiJS strokes are local-space.
 *
 * @param {import('./curve.js').Edge} edge
 * @param {number} zoom
 * @returns {{width: number, color: number, alpha: number}}
 */
export function pixiStroke(edge, zoom) {
  return {
    width: edge.worldWidth === false ? edge.width / zoom : edge.width,
    color: toPixiColor(edge.color),
    alpha: edge.color[3] ?? 1,
  }
}

/**
 * Draw edges into a PixiJS Container, replacing its children.
 *
 * One Graphics per edge; the container carries the shared viewport, so
 * calling this each frame with the same viewport convention
 * (`screen = world * zoom + pan`) keeps the PixiJS panel pixel-identical
 * to the WebGPU and SVG panels.
 *
 * @param {PixiLayer} layer
 * @param {import('./curve.js').Edge[]} edges - the same edge objects fed to `LineRenderer.render`
 * @param {{panX: number, panY: number, zoom: number}} view
 * @param {new () => PixiGraphics} Graphics - the PixiJS Graphics class
 */
export function drawEdgesPixi(layer, edges, view, Graphics) {
  layer.x = view.panX
  layer.y = view.panY
  layer.scale.set(view.zoom)
  layer.removeChildren()
  for (const e of edges) {
    const g = new Graphics()
    g.setStrokeStyle(pixiStroke(e, view.zoom))
    g.moveTo(e.x0, e.y0)
    g.bezierCurveTo(e.cx0, e.cy0, e.cx1, e.cy1, e.x1, e.y1)
    g.stroke()
    layer.addChild(g)
  }
}
