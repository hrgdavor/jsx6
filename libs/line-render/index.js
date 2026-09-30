/**
 * @jsx6/line-render — rendering and hit-testing for cubic Bezier (M/C) lines.
 *
 * Built for node editors (apps/nodditor) whose connectors are SVG
 * `M x y C ...` segments: it draws them in one instanced WebGPU draw call with
 * a zoom-independent stroke width, and picks them with a fast screen-space
 * hit test that stays accurate while panning and zooming.
 *
 * The pure functions (`parseLinePath`, `pickEdge`, `edgeDistance`, ...) work in
 * any environment without WebGPU — a DOM/SVG editor should adopt those first.
 * `LineRenderer` needs a WebGPU-capable browser.
 */
export { LineRenderer } from './src/renderer.js'
export { BLIT_SHADER, LINE_SHADER } from './src/shader.js'
export {
  distToSegment,
  edgeDistance,
  packEdges,
  pickEdge,
  sampleCubic,
  sampleTangent,
  screenToWorld,
  worldToScreen,
} from './src/curve.js'
export { edgeToPath, makeConnector, parseLinePath } from './src/path.js'
