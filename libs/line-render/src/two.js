/**
 * Two.js bridge — draw the same edges with Two.js.
 *
 * Two.js (MIT, ~200 KB min / ~50 KB gzip) is a full-featured 2D scene-graph
 * library with a renderer-agnostic API (SVG, Canvas 2D, WebGL backends).
 * The edge model maps 1:1, exactly like `src/pixi.js`:
 *
 *   edge { x0, y0, cx0, cy0, cx1, cy1, x1, y1, color, width, worldWidth }
 *     → one manual Two.Path with two anchors:
 *         a0 = new Two.Anchor(x0, y0, 0, 0, cx0 - x0, cy0 - y0)
 *         a1 = new Two.Anchor(x1, y1, cx1 - x1, cy1 - y1, 0, 0, Two.Commands.curve)
 *       Two's anchors carry RELATIVE handles by default, and its SVG
 *       renderer emits exactly `M x0 y0 C cx0 cy0 cx1 cy1 x1 y1` — the same
 *       path the native SVG panel draws, the same curve the WebGPU
 *       rasterizer tessellates. The Path must be constructed with
 *       `manual: true` (fourth argument): Two's automatic `plot()` step
 *       otherwise rewrites every anchor command to a straight line and the
 *       edges collapse to chords.
 *
 *   viewport  screen = world * zoom + pan
 *     → one Group transform:
 *         group.position.x = panX; group.position.y = panY
 *         group.scale = zoom
 *       Two's Group matrix is identity → translate → scale, so a child at
 *       world (x, y) lands at screen (x * zoom + panX, y * zoom + panY).
 *
 *   width semantics:
 *     worldWidth true  (default) — width in WORLD units. The Group scale
 *       turns it into `width * zoom` screen pixels (Two's default stroke
 *       attenuation), exactly like the WebGPU and SVG panels.
 *     worldWidth false          — width in SCREEN pixels. Set
 *       `path.strokeAttenuation = false` and Two.js divides by the world
 *       transform scale internally — the same compensation `pixiStroke`
 *       does manually.
 *
 *   Picking does not move at all: `pickEdge`, `edgeDistance` and
 *   `screenToWorld` are pure functions of (edges, viewport), so a Two.js
 *   project keeps the exact same hover/click behavior with zero rework.
 *
 * This module has NO two.js import: the `Two` namespace is injected by the
 * caller, so the package stays dependency-free and unit-testable. In an app
 * you add Two.js yourself (npm package `two.js` — NOT `two`, that is a
 * different library) and call `drawEdgesTwo(group, edges, view, Two)`.
 */

/**
 * The minimal structural shape of the Two.js Group that `drawEdgesTwo`
 * needs: it carries the shared viewport (position = pan, scale = zoom).
 *
 * @typedef {object} TwoGroup
 * @property {{x: number, y: number}} position
 * @property {number} scale
 * @property {unknown[]} children
 * @property {(objects: unknown | unknown[]) => void} add
 * @property {(objects: unknown[] | unknown) => void} remove
 */

/**
 * The minimal structural shape of the Two.js Path that `drawEdgesTwo`
 * needs: one stroke path per edge.
 *
 * @typedef {object} TwoPath
 * @property {unknown[]} vertices - the two anchors from `edgeAnchors`
 * @property {boolean} closed
 * @property {string} fill - set to 'none' for stroke-only edges
 * @property {string} stroke - CSS color `#RRGGBB`
 * @property {number} linewidth
 * @property {number} opacity
 * @property {boolean} strokeAttenuation - false → constant screen-pixel width
 */

/**
 * The minimal structural shape of the Two.js namespace that this module
 * needs: the `Anchor` and `Path` constructors (static members of the
 * entry class in the UMD build and the ESM default export).
 *
 * @typedef {object} TwoNamespace
 * @property {new (x: number, y: number, ax?: number, ay?: number, bx?: number, by?: number, command?: string) => unknown} Anchor
 * @property {new (vertices: unknown[], closed?: boolean, curved?: boolean, manual?: boolean) => TwoPath} Path
 * @property {{ curve: string, move: string, line: string, arc: string, close: string }} Commands
 */

/**
 * Convert a 0..1 `[r, g, b(, a)]` color to a Two.js CSS color string
 * `#RRGGBB`. Alpha is carried separately in `opacity`, not in the string.
 *
 * @param {number[]} color
 * @returns {string}
 */
export function toTwoColor(color) {
  const r = Math.round(color[0] * 255)
  const g = Math.round(color[1] * 255)
  const b = Math.round(color[2] * 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/**
 * Two.js stroke style for one edge.
 *
 * World-unit edges (the default) keep `width` as-is — the Group scale turns
 * it into `width * zoom` screen pixels. Screen-pixel edges set
 * `strokeAttenuation: false`; Two.js then divides by the world transform
 * scale internally, so no manual division by zoom is needed (unlike PixiJS).
 *
 * @param {import('./curve.js').Edge} edge
 * @returns {{color: string, width: number, opacity: number, strokeAttenuation: boolean}}
 */
export function twoStroke(edge) {
  return {
    color: toTwoColor(edge.color),
    width: edge.width,
    opacity: edge.color[3] ?? 1,
    strokeAttenuation: edge.worldWidth !== false,
  }
}

/**
 * The two Two.js anchors that describe one cubic edge.
 *
 * Two.js anchors carry relative handles by default: the first anchor's right
 * handle is the outgoing control relative to its point, the second anchor's
 * left handle is the incoming control, and its command is
 * `Two.Commands.curve` (the string `'C'`) so the renderer emits a `C`
 * segment for the pair.
 *
 * @param {import('./curve.js').Edge} edge
 * @param {TwoNamespace} Two
 * @returns {unknown[]} [startAnchor, endAnchor]
 */
export function edgeAnchors(edge, Two) {
  return [
    new Two.Anchor(edge.x0, edge.y0, 0, 0, edge.cx0 - edge.x0, edge.cy0 - edge.y0),
    new Two.Anchor(edge.x1, edge.y1, edge.cx1 - edge.x1, edge.cy1 - edge.y1, 0, 0, Two.Commands.curve),
  ]
}

/**
 * Draw edges into a Two.js Group, replacing its children.
 *
 * One Path per edge, in array order (Two draws children in order, no depth
 * test — the same z-ordering constraint as the WebGPU batch). The Group
 * carries the shared viewport, so calling this each frame with the same
 * viewport convention (`screen = world * zoom + pan`) keeps the Two.js panel
 * pixel-identical to the WebGPU and SVG panels.
 *
 * @param {TwoGroup} group
 * @param {import('./curve.js').Edge[]} edges - the same edge objects fed to `LineRenderer.render`
 * @param {{panX: number, panY: number, zoom: number}} view
 * @param {TwoNamespace} Two - the Two.js namespace (UMD global or `import Two from 'two.js'`)
 */
export function drawEdgesTwo(group, edges, view, Two) {
  group.position.x = view.panX
  group.position.y = view.panY
  group.scale = view.zoom
  group.remove(group.children)
  for (const e of edges) {
    // manual: true (4th argument) — otherwise Two's automatic plot() rewrites
    // every anchor command to a straight line and the edges collapse to chords
    const p = new Two.Path(edgeAnchors(e, Two), false, false, true)
    const s = twoStroke(e)
    p.fill = 'none'
    p.stroke = s.color
    p.linewidth = s.width
    p.opacity = s.opacity
    p.strokeAttenuation = s.strokeAttenuation
    group.add(p)
  }
}
