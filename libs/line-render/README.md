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
}
```

## API

- `parseLinePath(d, { color, width })` — SVG `M...C...` string → edge
- `edgeToPath(edge)` — edge → SVG `d` string
- `makeConnector(p1, p2, strength)` — the nodditor connector formula
  (horizontal tangents, strength clamped to half the point distance)
- `sampleCubic(edge, t)` / `sampleTangent(edge, t)` — point / derivative at `t`
- `distToSegment(px, py, x0, y0, x1, y1)` — point-to-segment distance
- `edgeDistance(edge, x, y, samples = 24)` — point-to-curve distance (sampled)
- `pickEdge(edges, screenX, screenY, panX, panY, zoom, samples, radiusPx)` —
  the edge under a screen point, or `null`; the closest candidate wins. The
  per-edge pick radius is the LARGER of the edge's rendered half-width and
  `radiusPx` screen pixels: `radiusPx = 0` → exact (only on the stroke); any
  larger value adds a thickness-independent tolerance (easy picking of thin
  lines in a graph)
- `screenToWorld(...)` / `worldToScreen(...)` — viewport transforms
- `packEdges(edges)` — the 16-float-per-edge layout for the GPU buffer
- `LINE_SHADER` — the WGSL source
- `BLIT_SHADER` — the WGSL source for the linear-downscale blit
- `LineRenderer` — the WebGPU renderer (always 4x MSAA; supersampling is
  OPT-IN and costs `supersample^2` pixels):
  - `new LineRenderer(canvas, { segmentsPerCurve = 32, clear, supersample = 1 })`
  - `await renderer.init()`
  - `renderer.setViewport(panX, panY, zoom)` (or set `panX`/`panY`/`zoom` directly)
  - `renderer.setSupersample(n)` — opt into higher-quality antialiasing
    (render at `n`x resolution with 4x MSAA, linear-downscale); default 1
    keeps the plain 4x MSAA path
  - `renderer.render(edges)` — clears and draws all edges in one draw call
  - `renderer.dispose()`

The viewport convention is `screenPos = worldPos * zoom + pan`, the same
convention nodditor uses for its pan/zoom.

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

A complete, runnable side-by-side — WebGPU, PixiJS 8, and native SVG drawing the
same edges, the same grid, under one shared pan/zoom and one shared picker —
is in `docs/compare.html`.

| Build                                                                                          | Minified                | Min + gzip            |
| ---------------------------------------------------------------------------------------------- | ----------------------: | --------------------: |
| **line-render** (whole package, bundled)                                                       | **10.4 KB**             | **4.0 KB**            |
| PixiJS 8.21.0 full dist — the `dist/pixi.min.mjs` the compare page actually loads from the CDN | 810 KB                  | 229 KB                |
| **Aggressive deep imports** — only the `Application`, `Container`, `Graphics` class modules (the exact trio the compare page uses) | 421 KB | 123 KB |

**Bottom line:** PixiJS 8 is ~30× line-render even at its leanest: ~123 KB vs ~4 KB min+gz for this lib.


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
  WebGPU canvas, a PixiJS 8 canvas, and a native SVG rendering of the exact same
  edges and grid under one shared pan/zoom and one shared picker. If the
  implementations are correct, the three panels overlap pixel for pixel at any
  zoom. Checkboxes: "supersampling ×2" opts into the higher-quality antialiasing
  path (the plain 4x MSAA path is the default); "lines scale with zoom" and
  "grid scales with zoom" (both on by default) switch the stroke width between
  world units (scales with zoom) and zoom-independent screen pixels — the SVG
  panel mirrors the switch with `vector-effect="non-scaling-stroke"`, and the
  PixiJS panel keeps the same world-unit / `width / zoom` semantics from
  `src/pixi.js`.

## Notes

- The canvas is used 1:1: `canvas.width`/`canvas.height` (backing-store pixels)
  is both the draw surface and the coordinate space for hit testing. Do not
  CSS-scale the canvas, or account for the scale yourself.
- `pickEdge` is the closest-candidate picker: when two edges are both within
  the threshold, the nearer one wins (a deliberate upgrade over a first-match
  `find`).
- GPU buffers are created once and grown as the batch grows; a frame costs two
  `writeBuffer` calls and no buffer allocation.
- `docs/webgpu-pitfalls.md` — the MSAA/supersampling caveats and every
  initialization error hit along the way (uniform fetch layout, MSAA resolve
  direction, WGSL builtin names, required `layout`, `TEXTURE_BINDING`, ...).
