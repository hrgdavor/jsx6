/**
 * @jsx6/line-render — rendering and hit-testing for cubic Bezier (M/C) lines.
 *
 * Built for node editors (apps/nodditor) whose connectors are SVG
 * `M x y C ...` segments: it draws them in one instanced WebGPU draw call
 * with a world-unit stroke width (thickness scales with zoom; `worldWidth:
 * false` opts into the legacy zoom-independent screen-pixel width), and
 * picks them with a fast screen-space hit test that stays accurate while
 * panning and zooming.
 *
 * The pure functions (`parseLinePath`, `pickEdge`, `edgeDistance`, ...) work in
 * any environment without WebGPU — a DOM/SVG editor should adopt those first.
 * `LineRenderer` needs a WebGPU-capable browser.
 *
 * The edge model maps 1:1 onto PixiJS 8 Graphics stroke paths, and the
 * viewport maps onto one container transform, so a project can grow into
 * PixiJS without rework — see `src/pixi.js` and the README section
 * "Migrating to PixiJS 8".
 *
 * The same mapping works on Two.js, the medium-size full-featured 2D
 * direction (~200 KB minified / ~50 KB gzip, between this ~10.6 KB library
 * and PixiJS's ~829 KB): one `Two.Path` per edge, one `Two.Group` viewport —
 * see `src/two.js` and the README section "Migrating to Two.js".
 *
 * Straight lines, circle outlines and polygon outlines are supported too, as
 * lists of degenerate / circular Bezier edges (`lineEdge`, `circleEdges`,
 * `polygonEdges`) — they render through the same single instanced draw call,
 * unchanged shader and buffer. See `src/shapes.js`.
 */
export { LineRenderer } from './src/renderer.js'
export { BLIT_SHADER, LINE_SHADER } from './src/shader.js'
export {
  distToPolyline,
  distToSegment,
  edgeDistance,
  packEdges,
  pickEdge,
  polylineBounds,
  sampleCubic,
  sampleEdgePoints,
  sampleTangent,
  screenToWorld,
  worldToScreen,
} from './src/curve.js'
export { connectorEdge, edgeToPath, makeConnector, parseLinePath } from './src/path.js'
export { circleEdges, lineEdge, polygonEdges } from './src/shapes.js'
export { drawEdgesPixi, pixiStroke, toPixiColor } from './src/pixi.js'
export { drawEdgesTwo, edgeAnchors, toTwoColor, twoStroke } from './src/two.js'
