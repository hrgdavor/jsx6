# @jsx6/line-render - 10KB minified / 4KB-gz

Rendering and hit-testing for cubic Bezier (`M x y C ...`) lines — the connector shape used by `apps/nodditor`.



![comparison](doc/images/compare.png)



It exists so a node editor can draw its connectors on a fast canvas layer
instead of (or in addition to) SVG:

- **world-unit stroke width by default** — a `width: 4` edge is 4 world units
  wide, so the rendered thickness scales with zoom; set `worldWidth: false` on
  an edge to keep the legacy zoom-independent, screen-pixel width instead;
- **batch rendering** — all edges in ONE instanced WebGPU draw call
  (one triangle strip per curve, sampled in the vertex shader);
- **fast hit detection** — a pure-JS screen-space picker that converts the
  click to world space and tests distance against a zoom-corrected threshold,
  so picking stays accurate while panning and zooming.

The pure functions work in Node and browser without WebGPU; a DOM/SVG editor
should adopt those first and treat `LineRenderer` as the optional canvas layer.
`LineRenderer` needs a WebGPU-capable browser (Chromium with WebGPU enabled).

## Edge data

One edge is one cubic Bezier segment in world coordinates — exactly the format
of an SVG `d` attribute `M x0 y0 C cx0 cy0 cx1 cy1 x1 y1`:

```js
const edge = {
  x0: 351.95, y0: 148.96,
  cx0: 411.95, cy0: 148.96,
  cx1: 179.95, cy1: 498.96,
  x1: 239.95, y1: 498.96,
  color: [0.2, 0.7, 1.0, 1.0], // RGBA, 0..1
  width: 4, // WORLD units by default (scales with zoom)
  worldWidth: false, // optional — omit for the default world-unit width
  // optional caches of THIS shape, in world coordinates (see "Picking with
  // cached geometry"): the sampled polyline and its AABB
  points: sampleEdgePoints(edge, 24),
  pointsBox: polylineBounds(points),
}
```

## API

- `parseLinePath(d, { color, width, worldWidth })` — SVG `M...C...` string → edge.
  `worldWidth: false` is carried through (screen-pixel width); omitting it means
  the default WORLD-unit width, so it is only recorded when it is `false`
- `edgeToPath(edge)` — edge → SVG `d` string (geometry only)
- `connectorEdge(p1, p2, strength)` — the nodditor connector formula as DATA (an
  edge with no style yet); `makeConnector` is `edgeToPath(connectorEdge(...))`, so
  the string form and the numeric form cannot drift
- `makeConnector(p1, p2, strength)` — the nodditor connector formula
  (horizontal tangents, strength clamped to half the point distance)
- `sampleEdgePoints(edge, segments = 24)` — the curve as a flat polyline
  (`Float64Array` of `x, y` pairs, WORLD coordinates): the geometry hit detection
  walks, and the thing to cache per shape. Returns `(segments + 1) * 2` numbers
- `polylineBounds(points)` — `[minX, minY, maxX, maxY]` of such a polyline
- `distToPolyline(points, x, y)` — point-to-polyline distance (exact for that
  polyline, so it can RANK edges; see the `pickEdge` note on early exits)
- `lineEdge(x0, y0, x1, y1, opts)` — a straight segment as a degenerate cubic
  Bezier (control points at 1/3 and 2/3 along the segment)
- `circleEdges(cx, cy, r, segments = 4, opts)` — a circle OUTLINE as
  `segments` cubic Bezier arcs (default 4)
- `polygonEdges(points, opts)` — a polygon OUTLINE as one degenerate cubic
  per side, closed by default (`close: false` for an open polyline)
- `sampleCubic(edge, t)` / `sampleTangent(edge, t)` — point / derivative at `t`
- `distToSegment(px, py, x0, y0, x1, y1)` — point-to-segment distance
- `edgeDistance(edge, x, y, samples = 24)` — point-to-curve distance (sampled)
- `pickEdge(edges, screenX, screenY, panX, panY, zoom, samples, radiusPx)` —
  the edge under a screen point, or `null`; the closest candidate wins. The
  per-edge pick radius is the LARGER of the edge's rendered half-width and
  `radiusPx` screen pixels: `radiusPx = 0` → exact (only on the stroke); any
  larger value adds a thickness-independent tolerance (easy picking of thin
  lines in a graph). An edge carrying the optional `points`/`pointsBox` caches
  (see below) is rejected on its box and then walked as a polyline instead of
  being re-sampled
- `screenToWorld(...)` / `worldToScreen(...)` — viewport transforms
- `packEdges(edges, out?)` — the 16-float-per-edge layout for the GPU buffer.
  `out` is an optional scratch array to pack into: when it is big enough it is
  reused and returned (one array for the whole render loop instead of one per
  frame), and only the live prefix is written
- `LINE_SHADER` — the WGSL source
- `BLIT_SHADER` — the WGSL source for the linear-downscale blit
- `LineRenderer` — the WebGPU renderer (always 4x MSAA; supersampling is
  OPT-IN and costs `supersample^2` pixels):
  - `LineRenderer.isSupported()` — SYNCHRONOUS probe of `navigator.gpu`, for a UI
    decision (disable a "GPU layer" toggle). Not a guarantee: the adapter request
    can still fail
  - `await LineRenderer.create(canvas, opts)` — build AND initialise in one call;
    resolves with a ready renderer, or with `null` after reporting the cause
    through `console.warn`. Use `new` + `init()` when the host wants the error
    (a usage error, such as a bad `supersample`, throws from `create()` too)
  - `new LineRenderer(canvas, { segmentsPerCurve = 32, clear, supersample = 1, onLost, device })`
    — `device` is a BORROWED `GPUDevice` to draw on (see "Device ownership and
    sharing")
  - `await renderer.init()`
  - `renderer.setViewport(panX, panY, zoom)` (or set `panX`/`panY`/`zoom` directly)
  - `renderer.setSupersample(n)` — opt into higher-quality antialiasing
    (render at `n`x resolution with 4x MSAA, linear-downscale); default 1
    keeps the plain 4x MSAA path
  - `renderer.render(edges)` — clears and draws all edges in one draw call;
    throws once the device is lost (see `onLost`)
  - `renderer.dispose()` — releases the buffers, textures, context and — unless
    the device was borrowed — the GPU device `init()` acquired. Single-use
    afterwards, idempotent, and safe after a failed `init()`. See "Device
    ownership and sharing" below
  - `onLost(info)` is called ONCE if the GPU device is lost (driver reset, GPU
    process crash) so the host can fall back to another layer. A loss raised by
    `dispose()` is not reported

The viewport convention is `screenPos = worldPos * zoom + pan`, the same
convention nodditor uses for its pan/zoom.

The canvas is **transparent**: the context is configured with
`alphaMode: 'premultiplied'` (the WebGPU default `opaque` would composite a
transparent clear as a black rectangle), so a `clear` of `[0, 0, 0, 0]` — or
any half-transparent color — lets the page background show through. Edge
colors are still passed as straight `RGBA 0..1`; the renderer premultiplies
them by alpha for compositing. The `clear` value goes straight to WebGPU and
is interpreted as premultiplied (identical for opaque, alpha-1 colors).

### Picking with cached geometry

Hit detection does not have to re-sample the curve on every click, and it does not
have to rebuild anything when the user pans or zooms. Attach the two optional caches
to an edge and `pickEdge` uses them:

```js
edge.points = sampleEdgePoints(edge, 24) // Float64Array of x, y pairs — world space
edge.pointsBox = polylineBounds(edge.points) // [minX, minY, maxX, maxY]
```

- `pointsBox` is tested FIRST: four comparisons reject an edge whose box (inflated by
  the pick radius) does not contain the pointer. The box is the hull of the polyline,
  so the reject is exact — a skipped edge could not have won.
- `points` is then walked with `distToPolyline`, which is the same 24-segment
  approximation `edgeDistance` computes, so cached and uncached picks agree
  bit-for-bit (4000 random picks over 500 connectors: 0 mismatches).
- Both caches are in WORLD coordinates and picking converts the POINTER into that
  space (`screenToWorld`), so **pan and zoom never invalidate them** — the only thing
  that does is a change of the shape itself.

Measured on 1000 connectors (24 samples, 4 px pick radius):

| pick path | ms per pick |
| --------- | ----------: |
| sample the curve per pick (no caches) | 0.633 |
| cached `points` + `pointsBox` | **0.028** |
| ... plus an early exit inside the polyline walk | 0.010 |

There is deliberately **no early exit** in `distToPolyline`: stopping at the first
sample inside the pick band overstates that edge's distance (the true minimum may be
a later sample), and `pickEdge` RANKS edges, so an overstatement can hand the pick to
a farther line. The box reject already removes the bulk of the work — the last row is
what the approximate version would have added, and it is not worth an answer that is
only usually the closest.

### Device ownership and sharing

`init()` acquires everything the renderer draws with — an adapter, a `GPUDevice`
and the `webgpu` context of ITS canvas — and `dispose()` releases all of it,
`device.destroy()` included. Nothing is created before `init()`, so the picker
(`pickEdge`, `edgeDistance`) needs no device at all.

A renderer therefore OWNS its device by default, and **N canvases mean N
devices**: two `LineRenderer`s call `requestAdapter()`/`requestDevice()` twice.
The batching is unaffected — each renderer still draws its batch in ONE instanced
call — so what multiplies is per-device state, not draw calls. That is fine for
one editor and wasteful for many small ones.

To put ONE device behind several canvases, hand the same `device` to every
renderer. Such a device is **borrowed**: `init()` skips the adapter/device
request, and `dispose()` releases only that renderer's buffers, textures and
canvas context and leaves the device alive — destroying it stays the caller's
job.

```js
import { LineRenderer } from '@jsx6/line-render'

// the host owns the device; the renderers each own their canvas context
const adapter = await navigator.gpu.requestAdapter()
const device = await adapter.requestDevice()

// `create()` resolves with null (after a console warning) when WebGPU is not
// available, so no try/catch is needed for the degraded path
const rendererA = await LineRenderer.create(canvasA, { device, onLost: useSvgLayer })
const rendererB = await LineRenderer.create(canvasB, { device, onLost: useSvgLayer })

rendererA.render(edgesA)
rendererB.render(edgesB)

rendererA.dispose() // its context/buffers only — `device` is untouched
rendererB.dispose()
device.destroy() // the host's call, once it is done with ALL of them
```

What that costs and what to watch for:

- Sharing reduces the number of *devices*, never the number of canvas
  *contexts* (one per canvas) or of per-renderer buffers.
- `renderer.ownsDevice` is `false` for a borrowed device — that flag, not
  `renderer.device`, is what decides whether `dispose()` destroys it. Reading
  `renderer.device` and destroying it yourself still breaks every other renderer
  on that device.
- A shared device is lost for EVERY renderer on it at once, so each one reports
  through its own `onLost` (including when the owner destroys it). Dispose all
  the renderers before destroying the device.
- The canvas format comes from `navigator.gpu.getPreferredCanvasFormat()`; with a
  borrowed device and no `navigator.gpu` to ask (a stubbed global, a worker
  shim), it falls back to `bgra8unorm`.
- Two renderers must not share one canvas: each renderer configures the `webgpu`
  context it was constructed with.

## Other shapes (lines, circles, polygons)

The renderer is a batch of cubic Bezier strokes, and every 2D outline is a
chain of such strokes — so straight lines, circle outlines and polygon
outlines need **no shader, buffer, or draw-call changes**; they are just
`Edge` lists from `src/shapes.js`:

- `lineEdge(x0, y0, x1, y1, opts)` — a straight segment as a *degenerate*
  cubic Bezier (control points at 1/3 and 2/3 of the segment). The strip
  becomes an exact rectangle and `pickEdge` reduces to an exact segment
  distance.
- `circleEdges(cx, cy, r, segments = 4, opts)` — a circle **outline** as
  `segments` cubic Bezier arcs with the standard Bezier-circle control offset
  `kappa = (4/3) * tan(pi / (2 * segments))` (0.55228475... for 4 arcs); a
  four-arc circle has a maximum radial error under one part in a thousand of
  the radius ([Wikipedia, "Bezier curve"](https://en.wikipedia.org/wiki/Bezier_curve)).
  Adjacent arcs share their endpoints **and** their tangents, so the triangle
  strips meet cleanly at the seams — no visible gap or overlap.
- `polygonEdges(points, opts)` — a polygon **outline** as one degenerate cubic
  per side, closed by default.

Corner caveat: each strip ends in a flat cap perpendicular to its own
tangent, so a polygon corner is a small notch rather than a miter or round
join. Invisible at connector-like widths; visible on wide strokes. Circle
outlines never show it (no corners). **Filled** shapes are not supported —
the pipeline is stroke-only; use SVG or PixiJS (see the migration section)
for fills.

## Why one instanced draw call — and what it constrains

Everything above renders through the same single `renderer.render(edges)`: one
flat `Float32Array` (16 floats per edge, 64-byte stride), one GPU buffer, and
one [`pass.draw(vertexCount, instanceCount)`](https://developer.mozilla.org/en-US/docs/Web/API/GPURenderPassEncoder/draw)
in which each instance reads its edge via `@builtin(instance_index)`
([spec: `GPURenderCommandsMixin.draw()`](https://www.w3.org/TR/webgpu/#dom-gpurendercommandsmixin-draw)).
That is the point of instancing: the per-shape variation (geometry, color,
width, `worldWidth`) is *data, not pipelines* — mixing straight lines,
beziers, circles and polygons costs zero extra draw calls, zero extra
pipelines, and zero extra bind groups.

The fixed 16-float stride is what makes this work: `packEdges` writes one
plain contiguous array and the WGSL `array<Edge>` has the exact matching
layout — the `vec2f` pairs at bytes 0..32, `color: vec4f` at 32..48,
`width`/`worldWidth`/pad at 48..64 ([WGSL memory layout](https://github.com/sotrh/learn-wgpu/blob/master/docs/showcase/alignment/README.md),
[WebGPU spec](https://www.w3.org/TR/webgpu/)). Adding a per-shape field
(e.g. a join type) would change the stride of *every* edge and re-couple
`packEdges` with the shader — the layout is deliberately minimal, which is
why the shapes are expressed in Bezier space on the CPU side instead of being
new GPU primitives.

What the single-pass design constrains (the "combining/ordering" problem):

- **Array order = z-order.** There is no depth test: edges blend in array
  order, so how the caller concatenates shape batches fixes the visual
  stacking. Reordering is cheap (array order only), but you cannot interleave
  per-shape draw calls or per-shape blend modes.
- **One `segmentsPerCurve` for the whole batch.** A straight line wastes
  samples on it and a large circle wants more — one uniform value serves all
  shapes in the batch (the default 32 is already sub-pixel for all of them).
- **One buffer, one `writeBuffer` per frame.** The whole scene is one
  contiguous upload; per-shape buffers would mean per-shape draw calls and
  per-frame buffer churn — exactly the cost the batch exists to avoid.

## Migrating to PixiJS 8


This library is a focused implementation for one use case — not a fence around
it. When a project grows past it (filters, blend modes, particles, text,
sprites, or a WebGL-instead-of-WebGPU stack), the path to
[PixiJS 8](https://pixijs.com/) is a 1:1 mapping, not a rewrite:

| line-render                                   | PixiJS 8                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| edge `{ x0, y0, cx0, cy0, cx1, cy1, x1, y1 }` | `g.moveTo(x0, y0).bezierCurveTo(cx0, cy0, cx1, cy1, x1, y1).stroke()` — the final `.stroke()` commits the path; in PixiJS 8, `moveTo`/`bezierCurveTo` only *build* the path, and without `.stroke()` the `Graphics` draws nothing |
| `color: [r, g, b, a]` (0..1)                  | `color: toPixiColor(edge.color)` (0xRRGGBB) + `alpha: edge.color[3]`    |
| `width` in world units (default)              | stroke width in local units — PixiJS strokes scale with the container scale, so thickness grows with zoom, exactly like the WebGPU/SVG rendering |
| `worldWidth: false` (screen pixels)           | stroke width `edge.width / zoom` (PixiJS has no `non-scaling-stroke`)   |
| viewport `screen = world * zoom + pan`        | `layer.x = panX; layer.y = panY; layer.scale.set(zoom)`                 |
| `renderer.render(edges)`                      | `drawEdgesPixi(layer, edges, view, Graphics)` — one `Graphics` per edge |
| `pickEdge` / `edgeDistance` / `screenToWorld` | **unchanged** — they are pure functions of (edges, viewport), so hover/click behavior carries over with zero rework |

The bridge lives in `src/pixi.js` and is exported from the package root
(`toPixiColor`, `pixiStroke`, `drawEdgesPixi`). It has **no pixi.js import** —
the `Graphics` class is passed in by the caller — so the package stays
dependency-free and unit-testable; an app adds `pixi.js` itself only when it
actually migrates.

## Migrating to Two.js

[Two.js](https://github.com/jonobr1/two.js) is the **medium-size full-featured
2D direction**: a complete 2D scene graph (groups, shapes, animation, and
SVG / Canvas 2D / WebGL backends) at ~205 KB minified / ~50 KB gzip —
between this ~10 KB library and PixiJS 8's ~810 KB full dist. It is the right
choice when a project needs a real scene graph (transforms, animation, mixed
content) without the WebGL weight of PixiJS.

The edge model maps 1:1, the same way as PixiJS:

| line-render                                   | Two.js                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| edge `{ x0, y0, cx0, cy0, cx1, cy1, x1, y1 }` | `new Two.Path([a0, a1], false, false, true)` — closed `false`, curved `false`, manual `true` (**required**: without manual, Two's automatic `plot()` step rewrites every anchor command to a straight line and the edges collapse to chords) — with `a0 = new Two.Anchor(x0, y0, 0, 0, cx0 - x0, cy0 - y0)` and `a1 = new Two.Anchor(x1, y1, cx1 - x1, cy1 - y1, 0, 0, Two.Commands.curve)`; Two's anchors carry relative handles, and its SVG renderer emits exactly `M x0 y0 C cx0 cy0 cx1 cy1 x1 y1` |
| `color: [r, g, b, a]` (0..1)                  | `stroke: toTwoColor(edge.color)` (CSS `#RRGGBB`) + `opacity: edge.color[3]`, `fill: 'none'` |
| `width` in world units (default)              | `linewidth = edge.width` — the Group scale turns it into `width * zoom` screen px (Two's default stroke attenuation), exactly like the WebGPU/SVG rendering |
| `worldWidth: false` (screen pixels)           | `linewidth = edge.width`, `strokeAttenuation: false` — Two.js divides by the world scale internally; its native non-scaling stroke, no manual `÷ zoom` (unlike PixiJS) |
| viewport `screen = world * zoom + pan`        | `group.position.x = panX; group.position.y = panY; group.scale = zoom`             |
| `renderer.render(edges)`                      | `drawEdgesTwo(group, edges, view, Two)` — one `Two.Path` per edge, then `two.render()` (Two only repaints on demand when not playing) |
| `pickEdge` / `edgeDistance` / `screenToWorld` | **unchanged** — they are pure functions of (edges, viewport), so hover/click behavior carries over with zero rework |

The bridge lives in `src/two.js` and is exported from the package root
(`toTwoColor`, `twoStroke`, `edgeAnchors`, `drawEdgesTwo`). It has **no
two.js import** — the `Two` namespace is passed in by the caller — so the
package stays dependency-free and unit-testable; an app adds `two.js` itself
only when it actually migrates.

npm naming gotcha: the real package is **`two.js`** (jonobr1). The bare `two`
on npm is an unrelated package — install `two.js`, or load
`https://cdn.jsdelivr.net/npm/two.js@0.8.24/build/two.min.js` (UMD, global
`Two`) / `.../build/two.module.js` (ESM default export).

A complete, runnable side-by-side — WebGPU, Two.js, PixiJS 8, and native SVG
drawing the same edges, the same grid, under one shared pan/zoom and one
shared picker — is in `docs/compare.html`.

| Build                                                                                          | Minified                | Min + gzip            |
| ---------------------------------------------------------------------------------------------- | ----------------------: | --------------------: |
| **line-render** (whole package, bundled)                                                       | **10.4 KB**             | **4.0 KB**            |
| PixiJS 8.21.0 full dist — the `dist/pixi.min.mjs` the compare page actually loads from the CDN | 810 KB                  | 229 KB                |
| **Aggressive deep imports** — `Application`, `Container`, `Graphics` (3 the compare page uses) | 421 KB                  | 123 KB                |
| Two.js 0.8.24 — `build/two.min.js` from the npm tarball                                        | 205 KB                  | 50 KB                 |

**Bottom line:** the bundle-size spectrum runs **line-render (10.4 KB min /
4.0 KB gz) < Two.js (205 KB min / 50 KB gz) < PixiJS 8 (810 KB full / 421 KB
deep-import min; ~123 KB gz for the three classes the compare page uses)**.
Two.js is the medium-size full-featured 2D direction — a real scene graph with
SVG/Canvas/WebGL backends and a native non-scaling stroke — at ~20× line-render
and ~4× smaller than PixiJS 8 at its leanest. Raw connector drawing stays on
the 10 KB lib; a full-featured 2D scene without WebGL weight goes to Two.js;
a WebGL scene with filters, particles, and text goes to PixiJS.


## Demo

Serve the PACKAGE ROOT (not `docs/`), because the demo pages import `../index.js`,
which only resolves when the server root is the package directory:

```
bun x live-server libs/line-render
```

then open in a WebGPU-capable browser:

- `http://127.0.0.1:4000/docs/index.html` — the WebGPU canvas alone: wheel = zoom
  at the cursor, drag = pan, hover = highlight, click = pick.
- `http://127.0.0.1:4000/docs/compare.html` — side-by-side verification: the
  WebGPU canvas, a Two.js SVG, a PixiJS 8 canvas, and a native SVG rendering of
  the exact same edges and grid under one shared pan/zoom and one shared
  picker. If the implementations are correct, the four panels overlap pixel for
  pixel at any zoom. Checkboxes: "supersampling ×2" opts into the
  higher-quality antialiasing path (the plain 4x MSAA path is the default);
  "lines scale with zoom" and "grid scales with zoom" (both on by default)
  switch the stroke width between world units (scales with zoom) and
  zoom-independent screen pixels — the SVG panel mirrors the switch with
  `vector-effect="non-scaling-stroke"`, the Two.js panel with its native
  `strokeAttenuation: false`, and the PixiJS panel keeps the same world-unit /
  `width / zoom` semantics from `src/pixi.js`.

## Notes

- The canvas is used 1:1: `canvas.width`/`canvas.height` (backing-store pixels)
  is both the draw surface and the coordinate space for hit testing. Do not
  CSS-scale the canvas, or account for the scale yourself.
- `pickEdge` is the closest-candidate picker: when two edges are both within
  the threshold, the nearer one wins (a deliberate upgrade over a first-match
  `find`).
- GPU buffers are created once and grown as the batch grows; per frame the cost
  is two `writeBuffer` calls, one cached bind group, no buffer allocation and no
  per-frame `Float32Array` (the pack scratch is reused and only the live prefix
  is uploaded).
- Device lifetime, ownership and the (unsupported) sharing cases: see
  [Device ownership and sharing](#device-ownership-and-sharing).
- **Background / alpha caveat:** a WebGPU canvas defaults to `opaque` — with
  that setting a transparent `clear` still renders as a black rectangle,
  because the browser composites every pixel as alpha 1. `LineRenderer`
  therefore requests `alphaMode: 'premultiplied'`: a `clear` of
  `[0, 0, 0, 0]` (or any half-transparent color) lets the page background
  show through, while the default `clear` `[0.05, 0.05, 0.08, 1]` is opaque
  and paints a dark background. Every color written to the canvas — fragment
  output and `clearValue` — is premultiplied by its own alpha; edge colors
  are still passed to the API as straight `RGBA 0..1`.
  See `docs/webgpu-pitfalls.md`, entry 13.
- `docs/webgpu-pitfalls.md` — the MSAA/supersampling caveats and every
  initialization error hit along the way (uniform fetch layout, MSAA resolve
  direction, WGSL builtin names, required `layout`, `TEXTURE_BINDING`, ...).
