# line-render + nodditor — remaining suggestions (implementation plan)

**Status: open work.** This plan covers every suggestion from the `@jsx6/line-render` /
`@jsx6/nodditor` review that has **not** been implemented yet. The items that did land are listed
in [§0](#0-what-already-landed) so nothing below re-does them and the starting tree is unambiguous.

**Read first (fresh agent):**

1. [libs/line-render/README.md](../libs/line-render/README.md) — especially "Device ownership and
   sharing" and the `LineRenderer` API list; the library's identity is "everything is a cubic
   Bézier, one instanced draw call, 64-byte stride".
2. [apps/nodditor/README.md](../apps/nodditor/README.md) §"Line layer" — the layer contract and the
   WebGPU canvas layer.
3. [libs/line-render/src/curve.js](../libs/line-render/src/curve.js) (picking, packing),
   [src/renderer.js](../libs/line-render/src/renderer.js) (GPU lifetime),
   [src/shader.js](../libs/line-render/src/shader.js) (the vertex/fragment stages),
   [apps/nodditor/src/canvasLineLayer.js](../apps/nodditor/src/canvasLineLayer.js) (the seam).
4. [libs/line-render/docs/webgpu-pitfalls.md](../libs/line-render/docs/webgpu-pitfalls.md) — the
   catalogue of bugs that were found by hand; item [§6.1](#61-real-layer-parity-test--browser-check)
   exists to make that catalogue unnecessary.

**House rules that apply to every batch below:** `bun test` per package / `bun run test` at the
root discovers them; `bun run check:fast` = tests + `tsc --noEmit`; `bun run check` = the full gate.
`oxfmt` refuses to format `*.md` (ignored) and **fails with `spawn EPERM` on 6 HTML files in a
sandboxed shell** — that step needs an unrestricted shell, everything else of the gate runs fine
with `bun run check --no-format`.

---

## 0. What already landed

| # | Suggestion | Where it landed |
| - | ---------- | --------------- |
| 1 | `parseLinePath` silently dropped `worldWidth` (canvas lines scaled with zoom) | [path.js](../libs/line-render/src/path.js#L24), test in [index.test.js](../libs/line-render/index.test.js#L185) |
| 2 | Sampler typo `mipFilterMode` → `mipmapFilter` | [renderer.js](../libs/line-render/src/renderer.js#L273) |
| 3 | `packEdges(edges, out)` scratch reuse (no per-frame `Float32Array`) | [curve.js](../libs/line-render/src/curve.js#L204) |
| 4 | Cached edge bind group (was one `createBindGroup` per frame) | [renderer.js](../libs/line-render/src/renderer.js#L423) |
| 5 | Device-lost hook + full `dispose()` teardown (`unconfigure`, `device.destroy()`, idempotent) | [renderer.js](../libs/line-render/src/renderer.js#L472) |
| 6 | Capability helpers: `isSupported()`, `create()`, borrowed `opts.device` (`ownsDevice`) | [renderer.js](../libs/line-render/src/renderer.js#L170) |
| 7 | Canvas layer: dispose race, `ready` settles (`AbortError`), `onLost`, DPR watch, device forwarding, uses `isSupported`/`create` | [canvasLineLayer.js](../apps/nodditor/src/canvasLineLayer.js) |
| 8 | Demo: `onLost` → SVG fallback, `isSupported()` toggle probe | [index.jsx](../apps/nodditor/src/index.jsx#L131) |
| 9 | `LineRenderer` fake-WebGPU tests (was zero coverage), nodditor layer tests | [index.test.js](../libs/line-render/index.test.js#L507), [lineLayer.test.jsx](../apps/nodditor/test/lineLayer.test.jsx) |
| 10 | Docs: API list, "Device ownership and sharing" recipe, CHANGELOG entries | [libs README](../libs/line-render/README.md#L112), [nodditor README](../apps/nodditor/README.md#L425) |
| 11 | [1.1](#11-dispose-is-terminal--decide-and-document)(b) revivable canvas layer: `revive()`, `layer.disposed`, idempotent `add`, generation-guarded GPU startup/rAF, `setLineLayer` revival | [canvasLineLayer.js](../apps/nodditor/src/canvasLineLayer.js#L463), [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx#L1601), [lineLayer.js](../apps/nodditor/src/lineLayer.js#L10), tests in [lineLayer.test.jsx](../apps/nodditor/test/lineLayer.test.jsx#L499) |
| 12 | [2.1](#21-numeric-edge-as-the-source-of-truth) numeric edge as the source of truth + cached `svgText`/`points`/`pointsBox` + `changeId` from a process-wide sequence; the layers render (SVG writes the text, canvas pins a render edge) | [ConnectLine.js](../apps/nodditor/src/ConnectLine.js), [makeLineConnector.js](../apps/nodditor/src/makeLineConnector.js), [changeSeq.js](../apps/nodditor/src/changeSeq.js), [lineLayer.js](../apps/nodditor/src/lineLayer.js), [canvasLineLayer.js](../apps/nodditor/src/canvasLineLayer.js) |
| 13 | [3.2](#32-stop-re-parsing-d-per-frame) / [3.3](#33-edgeline-mutation) no SVG parse per frame, no per-frame edge allocation (pinned render edges, three refresh stamps) | [canvasLineLayer.js](../apps/nodditor/src/canvasLineLayer.js) (`edgeFor`/`edgeCache`) |
| 14 | [3.1](#31-pickedge-aabb-prefilter-over-cached-points--the-early-exit-was-rejected) AABB reject over cached polylines + polyline walk (`sampleEdgePoints`/`polylineBounds`/`distToPolyline`); the early exit was REJECTED | [curve.js](../libs/line-render/src/curve.js#L97), tests in [index.test.js](../libs/line-render/index.test.js) |
| 15 | [2.3](#23-formula-parity-test) formula/format/sampling parity between nodditor and line-render | [lineGeometry.test.js](../apps/nodditor/test/lineGeometry.test.js) |
| 16 | [5.1](#51-one-theme-for-both-layers-css-custom-properties) `--ne-line-*` theme driving BOTH layers, read (and re-read on a class/style change) by the canvas layer | [lineTheme.js](../apps/nodditor/src/lineTheme.js), [nodditor.css](../apps/nodditor/static/nodditor.css), [styling-migration.md](../apps/nodditor/doc/styling-migration.md), tests in [lineTheme.test.js](../apps/nodditor/test/lineTheme.test.js) |
| 17 | [5.2](#52-install-helper--honest-loadlinerender-failure) `installCanvasLineLayer` + honest `loadLineRender` failure | [canvasLineLayer.js](../apps/nodditor/src/canvasLineLayer.js) (`installCanvasLineLayer`), [index.js](../apps/nodditor/index.js) |
| 18 | [5.3](#53-pass-the-renderer-options-through) `clear`/`supersample` forwarded to the renderer | [canvasLineLayer.js](../apps/nodditor/src/canvasLineLayer.js) (`initRenderer`) |
| 19 | [6.1](#61-real-layer-parity-test--browser-check) browser check that settled [9.1](#9-open-decisions-need-the-maintainer-not-an-agent), then the policy it implied: the canvas strokes in **world units** (`worldWidth: true`, pick band scaled by zoom), `worldWidth: false` kept as the documented escape hatch, inert `vector-effect` dropped, `widthCss`/`hitWidthCss` renamed to `width`/`hitWidth` | [svgUtil.js](../apps/nodditor/src/svgUtil.js), [canvasLineLayer.js](../apps/nodditor/src/canvasLineLayer.js) (`edgeFor`/`pick`), [lineTheme.js](../apps/nodditor/src/lineTheme.js), [nodditor.css](../apps/nodditor/static/nodditor.css), tests in [lineLayer.test.jsx](../apps/nodditor/test/lineLayer.test.jsx) |

---

## 1. Lifecycle leftover

### 1.1 `dispose()` is terminal — decide and document

**Landed — option (b), revivable.** `dispose()` now releases the GPU session, listeners,
pixel-ratio watch and canvas element while keeping the layer object alive; `revive()` restores all
of it on a fresh GPU session and a fresh `ready`, the editor revives on the install path
(`onViewport`/`onResize`) and explicitly for `setLineLayer(activeLayer)`, and a generation counter
keeps a stale GPU startup or rAF frame from publishing over the new life. See
[canvasLineLayer.js](../apps/nodditor/src/canvasLineLayer.js#L463) and the `revive()` row of the
[LineLayer contract](../apps/nodditor/README.md#L409). The text below is the original analysis.

**What.** A disposed canvas layer can never be installed again: `dispose()` sets `disposed = true`
and a second call is a no-op, so `layer.dispose()` → `editor.setLineLayer(layer)` leaves a dead
layer installed (blank canvas, no drawing, `pick()` still answering from a stale edge list).

**Where.** [canvasLineLayer.js:108](../apps/nodditor/src/canvasLineLayer.js#L108) (`disposed`),
[`dispose()`](../apps/nodditor/src/canvasLineLayer.js#L435).

**Approach — the two options that were on the table:**

- **(a) Document it (S).** One row in the `LineLayer` contract table in the nodditor README
  ("`dispose()` is terminal — a layer is not reusable after it; build a new one") plus a sentence in
  the factory JSDoc. Zero behaviour change; the demo already builds a fresh layer per toggle.
- **(b) Make it revivable (M).** `dispose()` releases the renderer/listeners/canvas but keeps the
  object re-addable, with a per-life generation counter so a rAF/`ready`/GPU-startup continuation from
  the *old* life cannot resurrect state or publish over the new one. **← implemented** (see the
  status note above; the "stale edges / stale `ready`" footguns this option was warned about are what
  the counter and the fresh-promise-per-life design exist to prevent — a disposed life's `ready`
  rejects, the next life gets a new promise, and `dispose()` still clears the edge list).

**Tests landed:** `revive()` on a live layer is a no-op (same `ready`, no second GPU session); a
disposed layer is revived by re-installing it (canvas back in place, second session, drawing, picking,
lines re-registered); `setLineLayer` on the active disposed layer revives in place; a GPU startup from
a disposed life releases its device and never publishes (the revived session is the one that draws);
`revive()` does nothing on a destroyed editor; `add()` is idempotent.

---

## 2. Connector model (both packages)

### 2.1 Numeric edge as the source of truth

**Landed.** `ConnectLine.edge` holds the cubic as data (`connectorEdge`); `line.svgText`/`line.pathText`
(alias `line.d`) is the cached SVG text, and `line.points`/`line.pointsBox` the cached sampled polyline
+ AABB, all dropped together by `ConnectLine.changed()` when a new `changeId` is stamped from
`./changeSeq.js`. Rendering moved to the layers (the SVG layer writes the cached text into both
`<path>`s; the canvas layer pins one render edge per line and reads the line's points), so
`ConnectLine` no longer touches the DOM and no frame parses `d`. See
[ConnectLine.js](../apps/nodditor/src/ConnectLine.js), [makeLineConnector.js](../apps/nodditor/src/makeLineConnector.js),
[changeSeq.js](../apps/nodditor/src/changeSeq.js) and the "Connector geometry and its caches" section of
the [nodditor README](../apps/nodditor/README.md). This also lands [3.2](#32-stop-re-parsing-d-per-frame)
and [3.3](#33-edgeline-mutation) (see below), and the parity half of [2.3](#23-formula-parity-test).
The text below is the original analysis.

**What.** The canvas layer reconstructs geometry by regex-parsing the SVG `d` string that
`ConnectLine.updatePath()` just formatted: `makeLineConnector(...)` → `d` → `parseLinePath(d)` →
`Edge`. The round-trip through text is the per-frame cost in
[`buildEdges`](../apps/nodditor/src/canvasLineLayer.js#L142) and the reason `pick`/hover need to
re-parse at all.

**Where.** [makeLineConnector.js](../apps/nodditor/src/makeLineConnector.js#L16),
[ConnectLine.updatePath](../apps/nodditor/src/ConnectLine.js#L137),
[canvasLineLayer.buildEdges](../apps/nodditor/src/canvasLineLayer.js#L142),
[path.js](../libs/line-render/src/path.js#L62).

**Approach.**

1. Add `connectorEdge(p1, p2, strength, dir1, dir2)` to `libs/line-render/src/path.js` returning an
   `Edge` (control points `p1 + strength` / `p2 - strength` along the port direction), and express
   the existing `makeConnector` as `edgeToPath(connectorEdge(...))` so there is one formula.
2. In nodditor, `ConnectLine.updatePath()` writes `this.edge = connectorEdge(...)` **and** keeps
   `this.d = edgeToPath(this.edge)` for the SVG layer (the `d` stays the SVG contract; it is no
   longer the canvas layer's input).
3. `buildEdges` copies `{ ...line.edge, color, width, worldWidth: false }` — no regex, no parse per
   frame — and the `d`-keyed cache suggestion from the review disappears with it.

**Watch out.** `ConnectLine` must keep working **without** `@jsx6/line-render` (optional
dependency). Either guard the import (`loadLineRender()` already returns `null`) or keep the local
`makeLineConnector` as the fallback and assert both produce the same `d` (see 2.3).

**Tests.** `ConnectLine.edge` matches `parseLinePath(line.d)` numerically; nodditor layer test that
`buildEdges` output is unchanged (same numbers) before/after the refactor.

**Effort:** M. **Unlocks:** [3.3](#33-edgeline-mutation), [5.5](#55-lazy-line-element), hover
highlight.

### 2.2 Directions belong in the connector formula

**What.** `makeLineConnector(strength, p1, box1, box1pos, dir1, p2, box2, box2pos, dir2)` ignores
everything except the two points and the strength: `ConnectLine.updatePath()` calls it with the
same dummy `[100, 100], 'R'` / `[0, 0], 'L'`. The tangents are hard-coded horizontal, so the day a
node grows top/bottom ports, the formula, `makeConnector` and the glyph all need the same change in
two places.

**Where.** [makeLineConnector.js:16](../apps/nodditor/src/makeLineConnector.js#L16),
[ConnectLine.js:138](../apps/nodditor/src/ConnectLine.js#L138),
[path.js makeConnector](../libs/line-render/src/path.js#L62).

**Approach.** Take the port direction (or an explicit unit tangent) per endpoint; clamp `strength`
exactly as now; keep the `M…C…` output byte-identical for `R`/`L` so nothing else moves. Delete the
dead `box*`/`dir*` parameters from nodditor's signature in the same change.

**Tests.** Table test: R→L (unchanged), R→R, L→R, vertical T→B/B→T each produce the expected control
points; the existing nodditor `d` snapshots do not change for the demo graph.

**Effort:** S/M. **Depends on:** nothing (2.1 can follow or precede).

### 2.3 Formula parity test

**Landed** as `apps/nodditor/test/lineGeometry.test.js`: for a table of inputs (including degenerate
ones: same point, zero distance, clamped strength) it asserts that nodditor's `connectorEdge`/`edgeToSvg`
and line-render's `connectorEdge`/`edgeToPath`/`makeConnector` agree as DATA and as text, and that both
samplers produce identical points and bounds.

**What.** `makeConnector` (library) and `makeLineConnector` (nodditor) are the same math written
twice, and nodditor cannot import the library unconditionally.

**Approach.** A test in `apps/nodditor/test/` that builds both for a table of inputs (including
degenerate ones: same point, zero distance, clamped strength) and asserts equal strings. If 2.1/2.2
land first, assert equal `Edge` numbers instead.

**Effort:** S. **Why it matters:** a drift here silently moves every connector when a host toggles
the line layer — exactly the class of bug `worldWidth` was.

---

## 3. Performance

### 3.1 `pickEdge`: AABB prefilter over cached points — the early exit was REJECTED

**Landed (the useful half): exact AABB reject over cached polylines.** `pickEdge` now rejects an edge
on `edge.pointsBox` before touching it and walks `edge.points` (`distToPolyline`) instead of
re-sampling the curve; `sampleEdgePoints`/`polylineBounds`/`distToPolyline` are the library helpers
that fill those caches, and [2.1](#21-numeric-edge-as-the-source-of-truth) makes the connector hold
them. Measured over 1000 connectors (24 samples, 4 px pick radius):

| pick path | ms per pick |
| --------- | ----------: |
| sample the curve per pick (before) | 0.633 |
| cached `points` + `pointsBox` (landed) | **0.028** |
| ... plus a polyline early exit | 0.010 |

**Rejected: the early exit.** The prototype in the original suggestion stopped walking as soon as a
sample fell inside the pick band and below the current best. That is WRONG for ranking: the first
in-band sample can overstate the edge's true minimum (`m <= d_sample`), so a farther edge whose
distance falls between `m` and `d_sample` wins the pick. A 2000-pick random sweep did not hit it (the
window is bounded by the sampling error and the pick radius), and a 4000-pick sweep of the final
implementation shows 0 mismatches for the exact walk — but "usually the closest line" is not the
contract. The AABB reject already removes the bulk of the work (the last row is what the approximate
version would add), and picking is once per click today and ~0.17 % of a frame at 60 Hz even for 1000
connectors if hover ever calls it per `pointermove`.

**Test that pins it:** randomised parity between the cached-points path and the sampling path (400
picks, deterministic PRNG, `radiusPx` 0 and 4), plus the far-away-nothing case.

**What remains open:** a real spatial INDEX (loose grid / static AABB tree) over the per-line boxes.
It is not needed at the sizes measured (the linear scan with a box reject is already ~30 us for 1000
connectors, and a pick is not per-frame work), and when it is needed it should be updated from the
IDENTIFIED change (`line.onPathChange` gives the line that moved) rather than rebuilt on
`changeSeq()` — a global counter cannot say *what* changed. `changeSeq()` remains the coarse "did
anything change since X?" signal (the canvas layer uses it to decide whether its built edge list is
still current).

### 3.2 Stop re-parsing `d` per frame

**Landed** with [2.1](#21-numeric-edge-as-the-source-of-truth): the canvas layer builds its edge list
from `line.edge` and `line.samplePoints()`, and parses no SVG text at all — `parseLinePath` is no
longer imported by `canvasLineLayer.js`. The old per-frame cost it removes (`parseLinePath` + sampling
per connector per frame) measured 0.81 ms per 1000 connectors, against 0.23 ms for sampling each shape
ONCE per change.

The interim idea below is obsolete.

### 3.3 `edge.line` mutation

**Landed** with [2.1](#21-numeric-edge-as-the-source-of-truth): the canvas layer PINS one render edge
per line (`edgeCache`) and mutates it in place, so `edge.line` is set once instead of being stamped
onto a freshly allocated edge every frame — and a steady-state frame allocates no edge objects at all.
The refresh is driven by three stamps (`line.changeId`, the selection state, the device pixel ratio).

**Landed differently (and better):** the pinned render edge carries `line` as a permanent field, so
there is no stamp at all and `pick` still returns the edge it always did. The idea below (a parallel
array / `pickEdgeIndex`) is obsolete.

**What.** `buildEdges` stamps a pointer back onto the freshly parsed edge
([canvasLineLayer.js:151](../apps/nodditor/src/canvasLineLayer.js#L151)) and `pick` reads it
([:390](../apps/nodditor/src/canvasLineLayer.js#L390)). The parse creates objects with one hidden
class; the stamp immediately changes it, which is a (small) deoptimisation in the hot array.

**Approach.** Once [2.1](#21-numeric-edge-as-the-source-of-truth) makes the edge list a parallel
array of `ConnectLine`s, keep an index map instead: build `edgeLines[i] = line` alongside `edges[i]`
and have `pick` return `edgeLines[edges.indexOf(picked)]` (or return the index from a new
`pickEdgeIndex`). No property mutation, and `pickEdge` stays generic.

**Effort:** S. **Depends on:** 2.1 (otherwise a `WeakMap<Edge, ConnectLine>` is the alternative).

---

## 4. Rendering quality (all inside the existing single-draw design)

The stride is 64 bytes with **two unused pad floats** ([shader.js:24](../libs/line-render/src/shader.js#L24),
`packEdges` writes 14/15 as zero). Everything in this section either uses that free space or stays on
the CPU as a Bézier list — neither changes the pipeline count nor the draw-call count.

### 4.1 Per-edge segment count (fixes the documented "one `segmentsPerCurve` for the batch")

**Approach.** Interpret float 13's neighbour — `pad` at index 14 — as `segments` (0 = use the
uniform). `packEdges` writes `edge.segments ?? 0`; the vertex shader picks
`select(u.segmentsPerCurve, edge.segments, edge.segments > 0.5)` and clamps `t`. `lineEdge` and
polygon sides can then render with 2 segments instead of 32. Update the README's "What the
single-pass design constrains" bullet, which currently states this limitation.

**Tests.** `packEdges` writes the new float; a fake-device test asserting the vertex count
`(segments + 1) * 2` per instance is *not* available (draw is per-batch) — so assert the packed
value and the WGSL's arithmetic by inspection; keep the layout test in
[index.test.js](../libs/line-render/index.test.js#L142) as the stride guard.

**Effort:** M (shader + pack + docs).

### 4.2 Round joins for `polygonEdges`

**What.** Each strip ends in a flat cap, so polygon corners are notches
([shapes.js:93](../libs/line-render/src/shapes.js#L93)).

**Approach.** `polygonEdges(points, { joins: 'round' })` inserts a small arc `Edge` at every vertex
(centre = vertex, radius = `width / 2`, swept from the incoming to the outgoing normal) — a
CPU-side Bézier list, zero GPU changes, consistent with "every outline is a chain of Béziers".

**Tests.** A square with `joins: 'round'` gains 4 edges; each arc's endpoints coincide with the
side endpoints within epsilon; no arc for collinear vertices.

**Effort:** M.

### 4.3 Dashes

**Approach.** `dashEdges(edge, pattern, opts)` on the CPU: split the cubic at arc-length parameters
(de Casteljau) into the "on" sub-curves and return them as edges. Keeps the stride, so it works with
the current shader. Note the caveat in the docs: a dashed curve is many instances (one per dash).

**Effort:** M.

### 4.4 Analytic antialiasing in the fragment shader

**What.** Quality today comes from 4x MSAA only, with `supersample > 1` costing
`supersample²` pixels ([renderer.js](../libs/line-render/src/renderer.js#L277)).

**Approach.** Pass the local strip coordinate (signed distance from the centreline, in the same
units as the final screen position) plus the half width to the fragment stage; compute coverage with
`fwidth` and `smoothstep`, output premultiplied color × coverage. This makes the *default* path
smooth without extra pixels. Keep MSAA (it still helps the caps) and keep `supersample` as the
opt-in maximum-quality path.

**Tests.** The compare page ([docs/compare.html](../libs/line-render/docs/compare.html)) is the
verification instrument: the WebGPU panel must stay pixel-comparable with the SVG panel at several
zooms, with the checkbox on and off.

**Effort:** L (shader change; the risk is a regression in the alpha/premultiplied compositing that
`webgpu-pitfalls.md` entry 13 describes).

---

## 5. nodditor integration

### 5.1 One theme for both layers (CSS custom properties)

**Landed.** `--ne-line-color`, `--ne-line-selected`, `--ne-line-from-sel`, `--ne-line-to-sel`,
`--ne-line-width` and `--ne-line-hit-width` are declared in `static/nodditor.css` and consumed by its
line rules; the canvas layer reads the same resolved values (see `lineTheme.js`) and re-reads them when
the editor's `class`/`style` attribute changes, so a theme flip is live on both layers. Two
deviations from the sketch above, both deliberate: the pick band is expressed as the SVG layer's
`--ne-line-hit-width` (half of it is the band) instead of a separate `--ne-line-pick`, so the two
layers cannot disagree about it; and the values are never read per frame — resolving custom
properties in a render loop forces a style recalculation per line, so the observer is the only
re-read trigger. The precedence (to-sel > from-sel > selected > base) stays rule order in the
stylesheet plus `stateOf()` in the layer; a variable cannot express it. Tests:
[lineTheme.test.js](../apps/nodditor/test/lineTheme.test.js) (parsing + per-variable fallback) and the
"the stroke colours, width and pick band come from the theme" / "a theme change is picked up by the
live layer" cases in [lineLayer.test.jsx](../apps/nodditor/test/lineLayer.test.jsx).

**What.** The canvas layer hard-codes the four line colours, the 2 px stroke width, the 4 px pick
radius **and** the CSS rule precedence (to-sel > from-sel > selected > base) —
[canvasLineLayer.js:6–15](../apps/nodditor/src/canvasLineLayer.js#L6-L15). `static/nodditor.css`
declares those rules as *fallbacks a host is expected to override*, so in canvas mode a themed host
silently gets different colours.

**Approach.** Publish the theme as custom properties on the editor (`--ne-line-color`,
`--ne-line-selected`, `--ne-line-from-sel`, `--ne-line-to-sel`, `--ne-line-width`,
`--ne-line-pick`) with the current values as defaults in `static/nodditor.css`; read them once in
`makeCanvasLineLayer` via `getComputedStyle(editor)` and parse the colours to `[r, g, b, a]`.
Re-read on `onResize`/`onViewport` (or on a `MutationObserver` of the editor's `style`/`class`) if
live theming matters.

**Tests.** A nodditor test that sets `--ne-line-selected` on the editor and asserts the rendered
edge colour; default values must produce the existing constants (the current colour test stays
valid).

**Effort:** M. **Recommended first integration item** — it removes duplicated policy, which is where
the next divergence bug will come from.

### 5.2 Install helper + honest `loadLineRender` failure

**Landed.** `installCanvasLineLayer(editor, { lr, onLost, ...rendererOpts })` resolves with
`{ mode, layer, error }`; `mode: 'svg'` covers the missing package, no WebGPU and a failed start (in
which case the failed layer is swapped out for a fresh SVG layer), a lost device does the same swap
before calling the host's `onLost`, and `lr` can be injected (which is also what makes it testable).
The plan's suggested return shape said `{ layer, mode, ready }`; `ready` is dropped because the helper
already awaits it, and `error` is added because "no WebGPU" and "the renderer failed" need different
host reactions. `loadLineRender()` now warns differently for "not installed" vs "failed to load" and
logs the error in both cases. The demo toggle uses the helper.

**What.** Every host repeats the demo's ~25 lines: dynamic import, capability probe, build the
layer, `setLineLayer`, `ready.then/catch`, revert to SVG. And
[`loadLineRender`](../apps/nodditor/src/canvasLineLayer.js#L26) catches **every** import error and
reports "not installed" — a genuine throw inside the module is misreported, which is an expensive
warning to debug.

**Approach.**

1. `loadLineRender()`: distinguish "cannot resolve the specifier" from "the module threw while
   evaluating" and log the underlying `err` in both cases (`console.warn(msg, err)`); keep returning
   `null`.
2. Export `installCanvasLineLayer(editor, opts)` that does probe → `makeCanvasLineLayer` →
   `setLineLayer` → `ready` handling → SVG fallback on either failure, returning
   `{ layer, mode, ready }`. Keep `makeCanvasLineLayer` public for hosts that want the parts.

**Tests.** With a fake `lr` that rejects `create`, the helper leaves an SVG layer installed; with
`isSupported() === false` it never constructs a renderer; the returned `mode` reflects the outcome.

**Effort:** M.

### 5.3 Pass the renderer options through

**Landed.** `makeCanvasLineLayer(editor, lr, { segmentsPerCurve, clear, supersample, device, onLost })`
forwards `clear` (default `[0, 0, 0, 0]`) and `supersample` (default 1) to `LineRenderer.create`, and
the README documents that `supersample: 2` costs 4x the pixels. Test: "renderer options are passed
through to the renderer" in [lineLayer.test.jsx](../apps/nodditor/test/lineLayer.test.jsx).

**What.** `makeCanvasLineLayer(editor, lr, opts)` forwards only `segmentsPerCurve`, `device`,
`onLost`; `clear` is hard-coded to `[0, 0, 0, 0]` and `supersample` is unreachable, so a host cannot
opt into the higher-quality AA path from the review's §4.4.

**Approach.** Forward `clear` and `supersample` (and any future quality knob) to
`LineRenderer.create`. Keep the transparent default. Document in the nodditor README that
`supersample: 2` costs 4× the pixels.

**Effort:** S.

### 5.4 Document the pick semantics

**What.** Canvas picking is "closest edge within `max(halfWidth, radiusPx)`"; SVG picking is the
browser's (topmost 8 px hit stroke). The library README documents closest-wins; the nodditor README
does not, so overlapping lines look like a bug report waiting to happen.

**Approach.** One sentence in the canvas-layer section (plus a pointer to `pickEdge`'s docs). Say
explicitly that the tolerance is a deliberate difference from the SVG layer.

**Effort:** S.

### 5.5 Lazy line element

**What.** Every `ConnectLine` builds a `<g>` + two `<path>` ([ConnectLine.js:15](../apps/nodditor/src/ConnectLine.js#L15))
that is never attached to the DOM in canvas mode — 3 nodes per line, all carrying the `d` string the
canvas layer no longer needs once [2.1](#21-numeric-edge-as-the-source-of-truth) lands.

**Approach.** Create the element lazily on first `lineLayer.add()` **only for layers that attach**
(`kind === 'svg'`), or keep it but drop the second (transparent hit) path in canvas mode. The state
classes (`selected` / `ne-*-sel-block`) live on the `<g>` and are only read by CSS, so on the canvas
layer they can be dropped entirely.

**Effort:** M. **Depends on:** 2.1 (the canvas layer must stop reading `line.d`/`line.el`).
**Risk:** `NodeEditor` still looks up `this.lines.find(l => l.el == g)` for right-click/Enter — keep
a null-safe path for canvas mode.

---

## 6. Tests and docs leftovers

### 6.1 Real layer-parity test + browser check

**Status: the browser check is DONE (measured, not eyeballed) and it settled the policy; the parity
test landed in unit form; the demo edge is still open.**

**What.** The landed test asserted the canvas edge carried `worldWidth: false` and `width: 2`; it did
**not** compare the rendered canvas stroke with what the SVG layer actually paints. And nobody had
verified in a browser what `vector-effect: non-scaling-stroke` does under
`.ne-canvas { transform: scale() }` (an HTML ancestor transform) — the intent recorded in the code was
"constant 2 CSS px", and the point of this item was that the intent had never been checked.

**Outcome of the browser check (2026-02, Chrome 141 headless, `devicePixelRatio` 1, window 480x300).**
A five-band probe page (`.tmp/zoom-stroke/policy.html`) drew the same 2px vertical stroke five ways and
a screenshot was measured with a PNG dark-run decoder (`.tmp/zoom-stroke/measure-runs.mjs`). Two
calibration bars of known width (10px, 2px) measured 10px and 2px, so the harness itself is sound:

| band | transform | `vector-effect` | painted width |
| --- | --- | --- | --- |
| A | HTML ancestor `.ne-canvas{transform:scale(4)}` | **yes** | **8 px** |
| B | HTML ancestor `.ne-canvas{transform:scale(4)}` | no | 8 px |
| C | in-SVG `<g transform="scale(4)">` | **yes** | **2 px** |
| D | in-SVG `<g transform="scale(4)">` | no | 8 px |
| E | calibration 10px / 2px bars | — | 10 px / 2 px |

So the property **does** work (C vs D) but does **not** compensate a transform on an HTML ancestor
(A == B). That matches Blink's `LayoutSVGShape::ComputeNonScalingStrokeTransform`, which computes the
CTM to the **SVG root** plus `EffectiveZoom` and deliberately stops short of the host coordinate space
(the source comment says so and cites crbug.com/747708).

**Policy chosen: make the canvas match what the SVG actually paints** (the no-visual-change option).
The SVG line layer has always scaled with zoom, so `makeCanvasLineLayer` now strokes in **world units**
(`--ne-line-width`, `worldWidth: true`) and its pick band scales with the zoom, mirroring the
`--ne-line-hit-width` hit stroke the SVG paints inside the same scaled canvas. `theme.widthCss` /
`theme.hitWidthCss` were renamed to `width` / `hitWidth` (they are world units, not screen pixels), the
inert `vector-effect` was dropped from the line markup, and `opts.worldWidth: false` remains as the
supported escape hatch for a host that wants the *other* policy (constant screen thickness — which then
requires the `calc(var(--ne-line-width) / var(--ne-zoom, 1))` CSS on the SVG side to stay coherent).

**Remaining in this item.**

1. ~~Browser check~~ — done above; the numbers are also in
   [apps/nodditor/README.md](../apps/nodditor/README.md), [doc/styling-migration.md](../apps/nodditor/doc/styling-migration.md)
   and the CSS comment.
2. **Parity test:** the unit test now pins the policy at zoom 1 and 4
   (`test/lineLayer.test.jsx`: "edges are stroked in WORLD units…", "worldWidth: false opts into…"), and
   both modes' pick bands. A test that reads the SVG path's *computed* `stroke-width` is impossible in
   happy-dom (stylesheet rules are not applied to computed values — see `AGENTS.md` §2), so the pixel
   oracle above is the parity evidence for the SVG side, and the canvas side is a three-link chain that
   is each verified separately: the shader's world-width branch multiplies by `u.zoom`
   (`wPx = select(edge.width, edge.width * u.zoom, edge.worldWidth > 0.5)` — visible in the committed
   smoke bundle, `apps/nodditor/smoke/boot-page.bundle.mjs`), the layer sets that viewport to
   `zoom * devicePixelRatio` and the backing store to `css * devicePixelRatio`
   (`canvas layer: zoom and resize flow through…`, `…a device pixel ratio change resizes…`), and the
   width field is `--ne-line-width` world units (the new test). Net: `width * zoom * dpr` **device** px =
   `width * zoom` **CSS** px, which is exactly what the SVG paints. The one thing not yet done under
   SwiftShader is a pixel render of the canvas itself; it needs a bundle of `@jsx6/line-render` and a
   WebGPU-capable headless Chrome, and it would only re-check arithmetic that the three links above
   already pin.
3. **Demo coverage:** [docs/compare.html](../libs/line-render/docs/compare.html) still builds its edges
   by hand (`straightEdge(...)`), so `parseLinePath`'s options are never exercised by the demo. Add one
   panel/edge that goes through `parseLinePath`.

**Effort:** S for the demo edge. The browser check needed an unrestricted shell (Chrome cannot start
under the file sandbox: crashpad/IPC use named pipes) and took ~3 minutes with the harness committed
to the plan above; re-running it is a 2-command recipe (render the page with
`chrome --headless=new --screenshot=…`, measure with the dark-run decoder).

### 6.2 `pickEdge` doc: the `worldWidth` default

**What.** `parseLinePath` now documents "omitting `worldWidth` means world units"; the `pickEdge`
bullet in the library README describes `radiusPx`/half-width semantics but not that trap.

**Approach.** Add the one-clause warning next to the `pickEdge` bullet and in the `Edge` typedef
reference.

**Effort:** S.

### 6.3 Migration tables: `parseLinePath` is the only bridge that grows

**What.** The PixiJS 8 and Two.js tables promise "zero rework" for picking
([README](../libs/line-render/README.md#L247)). True for the pure functions, but `parseLinePath` is
the one bridge that must learn every new edge field (exactly the `worldWidth` failure mode).

**Approach.** One sentence under each table: "`pickEdge`/`edgeDistance` are pure and carry over
untouched; `parseLinePath` is the bridge that has to be taught new edge fields."

**Effort:** S.

---

## 7. Repo hygiene found during the work

### 7.1 The smoke bundles are stale and have no committed builder

`apps/nodditor/smoke/*.bundle.mjs` embed the nodditor sources (including
`canvasLineLayer.js`) but are **not** produced by any committed script — they were built ad-hoc from
scratch with the esbuild CLI, roughly:

```sh
node_modules/esbuild/bin/esbuild <entry.mjs> --bundle --format=esm --platform=node --target=esnext \
  --jsx=automatic --jsx-import-source=@jsx6 --loader:.js=tsx --loader:.jsx=tsx \
  --external:@happy-dom/global-registrator --outfile=apps/nodditor/smoke/<name>.bundle.mjs
```

(the committed bundles also carry `// apps/nodditor/src/<file>` banners, so the original build used a
small header plugin — reproduce that before diffing, or the regenerated bundles will not match). They
are not part of `bun run check` either (test discovery only picks up `*.test.*`), so nothing fails
when they go stale — which is what happened with the landed changes.

**Approach.** Either (a) commit a builder (`apps/nodditor/smoke/build.mjs`) plus a gate step that
regenerates and diffs them, or (b) delete them from the repo and generate on demand. Recommend (a):
they are the only end-to-end verification of the app in this repo.

**Effort:** M for (a).

### 7.2 `apps/nodditor/.oxfmtrc.json` is inert

The nested config sets `printWidth: 120` (root uses 110) and adds `smoke/*.bundle.mjs` /
`doc/*.bundle.mjs` to `ignorePatterns`. The gate's no-argument `oxfmt --check` scan applies the
**root** config everywhere and reports the tree clean; a directory-mode run
(`oxfmt --check apps/nodditor/src`) applies the nested one and flags three files that are not
formatted for it (`ConnectLine.js`, `NodeEditor.jsx`, `canvasLineLayer.js`).

**Approach — pick one:** delete the nested config (one formatting policy for the repo), or make it
the effective one (then reformat those files and make the gate use it). Do not leave the tree in two
policies; a contributor who runs `oxfmt apps/nodditor/src` gets a diff the gate will not accept.

**Effort:** S.

---

## 8. Suggested sequencing

Each batch is one reviewable change set (tests + docs inside it).

| Batch | Contents | Why together | Effort |
| ----- | -------- | ------------ | ------ |
| **A** | ~~[6.1](#61-real-layer-parity-test--browser-check) browser check → policy~~ **done** (measured: the SVG layer scales with zoom, so the canvas now strokes in world units; §[9.1](#9-open-decisions-need-the-maintainer-not-an-agent) closed) + parity test landed in unit form; still open in A: the [6.1](#61-real-layer-parity-test--browser-check) demo edge, [5.4](#54-document-the-pick-semantics), [6.2](#62-pickedge-doc-the-worldwidth-default), [6.3](#63-migration-tables-parselinepath-is-the-only-bridge-that-grows) | Small, closes out the landed work honestly | S |
| **B** | ~~[3.1](#31-pickedge-aabb-prefilter-over-cached-points--the-early-exit-was-rejected) picker~~, ~~[2.1](#21-numeric-edge-as-the-source-of-truth)~~, ~~[3.3](#33-edgeline-mutation)~~ — **landed** (see [§0](#0-what-already-landed) rows 12–14); what remains is the optional spatial index, only if a graph ever needs it | The picker prefilter is what makes per-move picking affordable; the numeric edge removes the parse that feeds it | done |
| **C** | ~~[5.1](#51-one-theme-for-both-layers-css-custom-properties) theme vars~~, ~~[5.2](#52-install-helper--honest-loadlinerender-failure) install helper~~, ~~[5.3](#53-pass-the-renderer-options-through) options pass-through~~ — **landed** (see [§0](#0-what-already-landed) rows 16–18) | Integration ergonomics; the theme removes the duplicated look, the helper removes the duplicated startup | done |
| **D** | ~~[2.3](#23-formula-parity-test) parity test~~ (landed with B), [2.2](#22-directions-belongs-in-the-connector-formula) directions, [5.5](#55-lazy-line-element) lazy element | Connector-model change; land it when vertical ports are actually needed, not before | M |
| **E** | [4.1](#41-per-edge-segment-count-fixes-the-documented-one-segmentspercurve-for-the-batch) segments, [4.4](#44-analytic-antialiasing-in-the-fragment-shader) analytic AA, [4.2](#42-round-joins-for-polygonedges) joins, [4.3](#43-dashes) dashes | Standalone shader/quality work, verified against the compare page; do it after A so the page is a trustworthy oracle | M–L |
| **F** | [7.1](#71-the-smoke-bundles-are-stale-and-have-no-committed-builder) smoke builder, [7.2](#72-appsnodditoroxfmtrcjson-is-inert) formatter policy | Repo hygiene; independent, can be done by anyone at any time | M |

---

## 9. Open decisions (need the maintainer, not an agent)

1. ~~The `worldWidth` policy~~ — **decided and measured**: the SVG layer scales with zoom (the zoom is
   an HTML ancestor transform, which `non-scaling-stroke` does not compensate: 8 painted px at zoom 4
   with the property, 8 px without, while an in-SVG transform paints 2 px), so the canvas layer strokes
   in world units and its pick band scales too; `opts.worldWidth: false` remains for the opposite
   policy. Evidence and the harness recipe are in [6.1](#61-real-layer-parity-test--browser-check).
2. ~~Terminal vs revivable `dispose()`~~ — **decided: revivable** (option (b)), see
   [1.1](#11-dispose-is-terminal--decide-and-document).
3. **Optional-dependency version guard.** `makeCanvasLineLayer` now calls
   `LineRenderer.isSupported()`/`create()` unguarded, so an older installed `@jsx6/line-render` breaks
   it (it already needed the `worldWidth` fix anyway). Choose: bump the declared dependency, add a
   `typeof`-guard fallback to `new`+`init()`, or accept the version requirement and document it.
4. **Should one device be the default for multi-editor hosts?** The borrowed-device API landed, but
   nodditor does not own a device: each canvas layer still requests its own unless the host passes
   one. A module-level `getSharedDevice()` helper in nodditor would make sharing the default.
5. **Hover highlighting.** [3.1](#31-pickedge-aabb-prefilter-over-cached-points--the-early-exit-was-rejected)
   makes per-`pointermove` picking viable (~30 µs over 1000 connectors, exact); nothing in the SVG layer
   highlights on hover today, so this is a new feature decision (and it needs a `--ne-line-hover`
   variable from [5.1](#51-one-theme-for-both-layers-css-custom-properties)).
6. ~~Early exit in the pick walk~~ — **decided: rejected**, see
   [3.1](#31-pickedge-aabb-prefilter-over-cached-points--the-early-exit-was-rejected) (it can overstate
   an edge's distance and mis-rank the pick; the AABB reject already removes the bulk of the work).

---

## 10. Verify (every batch)

```sh
bun run test                # every package's tests (root discovers them)
bun run check:fast          # + tsc --noEmit for every lib with a tsconfig
(cd apps/nodditor && bun x tsc --noEmit -p tsconfig.json)   # the app is not in the gate
bun run check --no-format   # full gate: declaration emit, oxlint, versions, docs sync, manifests, workspace
bun x oxfmt                 # format; `--check` needs an unrestricted shell (6 HTML files fail with spawn EPERM)
```

For anything touching the shader or the canvas layer, the manual check is the demo
(`cd apps/nodditor && bun start` → `http://127.0.0.1:5111`) with the SVG ↔ canvas toggle at zoom 1, 2
and 4, plus the library's own compare page — `bun x live-server libs/line-render`, then
`http://127.0.0.1:4000/docs/compare.html` (the server root must be the PACKAGE root, because the page
imports `../index.js`).
