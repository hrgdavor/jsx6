# @jsx6/line-render

Rendering and hit-testing for cubic Bezier (`M x y C ...`) lines — the connector
shape used by `apps/nodditor`.

It exists so a node editor can draw its connectors on a fast canvas layer
instead of (or in addition to) SVG:

- **adaptive line thickness on zoom** — strokes are extruded in *screen pixels*
  (not world units), so a `width: 4` line stays 4px wide at any zoom;
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
  width: 4, // SCREEN pixels, zoom-independent
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
  the edge under a screen point, or `null`; the closest candidate wins
- `screenToWorld(...)` / `worldToScreen(...)` — viewport transforms
- `packEdges(edges)` — the 16-float-per-edge layout for the GPU buffer
- `LINE_SHADER` — the WGSL source
- `LineRenderer` — the WebGPU renderer:
  - `new LineRenderer(canvas, { segmentsPerCurve = 32, clear })`
  - `await renderer.init()`
  - `renderer.setViewport(panX, panY, zoom)` (or set `panX`/`panY`/`zoom` directly)
  - `renderer.render(edges)` — clears and draws all edges in one draw call
  - `renderer.dispose()`

The viewport convention is `screenPos = worldPos * zoom + pan`, the same
convention nodditor uses for its pan/zoom.

## Demo

Serve the PACKAGE ROOT (not `docs/`), because the demo pages import `../index.js`,
which only resolves when the server root is the package directory:

```
bun x live-server libs/line-render
```

then open in a WebGPU-capable browser:

- `http://127.0.0.1:4000/docs/index.html` — the WebGPU canvas alone: wheel = zoom
  at the cursor, drag = pan, hover = highlight, click = pick.
- `http://127.0.0.1:4000/docs/compare.html` — side-by-side verification: the WebGPU
  canvas next to a native SVG rendering of the exact same edges and grid under one
  shared pan/zoom. If the implementation is correct, the two panels overlap pixel
  for pixel at any zoom.

## Notes

- The canvas is used 1:1: `canvas.width`/`canvas.height` (backing-store pixels)
  is both the draw surface and the coordinate space for hit testing. Do not
  CSS-scale the canvas, or account for the scale yourself.
- `pickEdge` is the closest-candidate picker: when two edges are both within
  the threshold, the nearer one wins (a deliberate upgrade over a first-match
  `find`).
- GPU buffers are created once and grown as the batch grows; a frame costs two
  `writeBuffer` calls and no buffer allocation.
