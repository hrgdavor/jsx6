# Change Log - @jsx6/nodditor

This log was last generated on Thu, 25 Apr 2024 11:46:22 GMT and should not be manually modified.

## Unreleased

- `loadGraph` now returns `{ attached, skipped }` — the line-attach counts it used to discard — so a
  host that persists the graph can tell whether it is safe to write the state back. Saving right after
  a LOSSY load is how a document loses its connections for good: the stored graph ends up with
  `lines: []`, and any loader that prefers stored data over a default then boots connection-less
  forever. See `README.md` (`loadGraph`).
- The DEMO page no longer persists anything: it renders its initial data on every reload. Its old
  `localStorage` restore had two failure modes worth not repeating — the demo never saved on connect
  (a line added interactively fires no graph-level event, so the demo's `ne-move-done`/`ne-remove`
  save triggers missed it and a reload right after connecting lost the line), and a stored graph
  outlived its format, because the boot preferred it over the seed and never re-seeded. Persisting is
  the host's job: save on your own connect path, and never write back a load that skipped lines.
  The demo also removes the `ne.graph`/`ne.positions` keys it used to write.
- **BREAKING (styling): the library stylesheet is now required.** The editor no
  longer writes inline styles; it publishes its layout as CSS custom properties
  (`--ne-x`/`--ne-y` per block, `--ne-zoom`/`--ne-zoom-w`/`--ne-zoom-h` on the
  canvas, `--ne-menu-x`/`--ne-menu-y`, `--ne-marquee-x/-y/-w/-h`) and
  `static/nodditor.css` turns them into `transform`/`left`/`top`. An app that
  does not load that file renders every block at the origin (in the corner),
  because the variables have nothing to drive. Add
  `<link rel="stylesheet" href="…/@jsx6/nodditor/static/nodditor.css" />`.
  `static/NodeEditor.css` still works — it is now a shim that `@import`s
  `nodditor.css` (library geometry) plus `ne-demo.css` (the demo's look).
  See `doc/styling-migration.md`.
- Removed: accessibility markup on LINES (`role="img"`, `tabindex="0"` and the
  endpoint `aria-label`). A focusable `<g>` is what made browsers — or any host
  `:focus` rule — draw a gray box around a selected line, duplicating the
  `.selected` stroke. Lines are no longer focusable; blocks keep `role="group"`,
  `tabindex` and a stable `aria-label` (`"Switch 1"`).
- Selection state is no longer written into the block `aria-label` (it was
  `"Switch 1 selected"`), because an accessible name must not change with
  selection.
- The misspelled `NodeEditor.lineinteraciton` property will be renamed to
  `lineinteraction` in v2 (breaking change). The old name is kept for now and
  the correctly spelled `lineinteraction` is available as an alias, so
  existing code keeps working until the v2 rename.
- UX (task P2): multi-select (Shift/Ctrl+click toggle, marquee on empty
  canvas, group drag, menu now centered over the whole selection), keyboard
  editing (arrow nudge with Shift=5x, Ctrl+A, Esc, Ctrl+Z / Ctrl+Shift+Z /
  Ctrl+Y, Ctrl +/-/0 zoom), undo/redo built on `saveGraph`/`loadGraph`
  (requires `editor.typeMap`), right-click context menu at the cursor for
  blocks and lines, and accessibility (ARIA roles/labels, tabbable blocks/
  lines).
- Removed: the `aria-live` selection-status element the editor used to inject
  (`"block 1 selected"` / `"selection cleared"`). It was only hidden by the
  demo stylesheet, so a host that did not load that file got the sentence as
  text on the canvas, and selection state is already carried by the `selected`
  attribute and the line stroke. `setAriaStatus()` remains as a no-op.
- Behavior change: dragging with the LEFT button on empty canvas now draws a
  selection marquee; canvas panning moved to MIDDLE button or Alt+left drag.
- Zoom: the hard 100% cap is replaced by configurable `zoomMin`/`zoomMax`
  (defaults 0.3–4) and a zoom indicator/controls UI is built into the editor.
  The `zoom` setter clamps now; optional grid snapping via `snap`.
- Performance (task P3): connector discovery is memoized per block (a canvas
  `MutationObserver` marks the blocks whose DOM changed structurally, so
  `findConnector` no longer walks every block on every resize notification);
  per-connector `ne-move` events are coalesced into ONE event per batch;
  selection membership is O(1); the selection menu box is measured once and
  reused, and `fireMoveDone` positions it in the same frame (no `setTimeout`);
  the connect-drag hit test (`document.elementFromPoint`) runs once per frame.
- Behavior change (P3-2): a connector move is no longer fired as a `ne-move`
  event on the connector element (and duplicated on the editor). One
  `ne-move` event is fired per batch on the editor element with
  `detail = { stamp, connectors }`, where each entry of `connectors` has
  exactly the old per-connector detail shape (`{...ConnectorData}`), and
  `con.movedStamp === detail.stamp` tells a listener in O(1) whether its own
  connector moved. Block-level `ne-move` (`{nid, left, top, pos, domNode}`)
  and `ne-move-done` are unchanged. `ConnectLine` and the demo were migrated.

- Maintenance (task P4): the package now has unit tests (`test/`, run by `bun test` with happy-dom
  and a `bunfig.toml`) and a README. Dead code was removed from the demo and the editor
  (`onMove`/`points`, the unused `menu.afterAdd` hook, two unused `index.jsx` imports, two unused
  CSS rules); no public API changed. Styling: `.h50` now sets `height` (it set `width`), and
  `.ne-block [ne-connect]` declares `display` once (`flex`, the value that won before).
- Pluggable line layer: the editor now draws its lines through `editor.lineLayer` (the default
  SVG layer keeps the pre-refactor behaviour: line `<g>`s in `editor.svgLayer`, selection as
  classes). `editor.setLineLayer(layer)` swaps the active layer — it takes the lines off the old
  layer before disposing it, re-adds them on the new one and replays the current selection. The
  layer contract is `kind`, `el`, `add`, `remove`, `setStates`, `pick`, `onViewport`, `onResize`,
  `dispose` (canvas layers additionally expose a `ready` promise).
- `@jsx6/line-render` is an **optional** dependency: the package works without it. With it,
  `loadLineRender()` + `makeCanvasLineLayer(editor, lr)` gives a WebGPU canvas line layer
  (`LineRenderer` draws the connectors, `pickEdge` handles line picking) as an alternative layer;
  if the renderer `init()` rejects (no WebGPU) the layer degrades — `ready` rejects, picking keeps
  working (pure curve math) and the demo falls back to the SVG layer. The canvas layer clears
  with a transparent color; `@jsx6/line-render` now configures its WebGPU context with
  `alphaMode: 'premultiplied'` (premultiplied fragment output), so that transparent clear
  renders transparent instead of a black rectangle. The demo page gained a toggle to switch
  SVG ↔ canvas line rendering. `test/lineLayer.test.jsx` covers both layers and the swap.
  `build_vanilla/` (vanilla build output) is gitignored like `build/`.
- The WebGPU line layer now draws a line **while it is being connected**: the free end of
  the line follows the pointer during a drag (its `d` is recomputed by
  `ConnectLine.updatePath` with `p2.con` still null), and the canvas layer subscribes to
  `ConnectLine.onPathChange` so the temporary connector tracks the pointer. Redraws are
  rAF-batched — per frame the cost is one `parseLinePath` per line plus one instanced GPU
  draw, the same budget as the `ne-move`/zoom redraw path (no per-event render, no
  per-line canvas, no buffer churn). `buildEdges` includes any line that has a path,
  matching what the SVG layer draws.
- The canvas layer now uses `@jsx6/line-render`'s host helpers instead of hand-rolling the
  GPU startup: `LineRenderer.isSupported()` is a synchronous probe, so a browser without
  WebGPU rejects `ready` immediately without asking for an adapter, and
  `LineRenderer.create()` resolves with `null` (reporting the cause to the console and
  releasing what it half-acquired) instead of throwing out of `init()`. `pick` and the
  `onLost`/dispose behaviour are unchanged.
- `makeCanvasLineLayer(editor, lr, { device })` accepts a **borrowed `GPUDevice`**, so a
  host that installs several editors can put them all on ONE device: `init()` skips the
  adapter/device request and `dispose()` (including the one `setLineLayer` does on a swap)
  no longer destroys a device it does not own. A device lost by its owner is reported to
  every layer drawing on it.
- Connector geometry is now DATA on the line, with every rendering derived from it and cached:
  `ConnectLine.edge` holds the cubic ([`connectorEdge`](src/makeLineConnector.js)), `line.pathText`
  (alias `line.d`) the cached SVG text, and `line.points`/`line.pointsBox` the cached sampled polyline
  and its AABB. `updatePath()` computes the edge, drops those caches and stamps a new `changeId` from a
  process-wide sequence ([src/changeSeq.js](src/changeSeq.js)) — a cache is validated against
  `line.changeId`, which is a LINE-LOCAL test (a global one would invalidate every line whenever one
  moved), while `changeSeq()` serves the coarser "did anything change?" check the canvas layer uses to
  know whether its built edge list is still current.
- Rendering moved to the layers, so `ConnectLine` no longer touches the DOM: the SVG layer writes the
  cached text into both `<path>`s on `add` and on every shape change (and releases that subscription in
  `remove`, which matters when `setLineLayer` takes the lines off it), and the canvas layer pins one
  render edge per line and refreshes geometry/colour/width only when the corresponding stamp moved. A
  frame no longer parses SVG text (`parseLinePath` is gone from the canvas layer) and allocates no edge
  objects: the per-frame shape work drops from 0.81 ms per 1000 connectors to a re-point at the pinned
  edges, with the sampling that used to happen per frame now costing 0.23 ms once per change.
- Hit detection walks the line's cached polyline and rejects on its cached AABB. Both caches live in
  world coordinates and picking converts the pointer into that space, so pan and zoom never invalidate
  them. `@jsx6/line-render`'s `pickEdge` uses the caches when present (0.63 ms → 0.028 ms per pick over
  1000 connectors) and gained `connectorEdge`, `sampleEdgePoints`, `polylineBounds` and
  `distToPolyline`; there is deliberately no early exit in the walk, because stopping at the first
  in-band sample can overstate a distance and hand the pick to a farther line.
- New public helpers on the package root: `connectorEdge`, `edgeToSvg`, `sampleEdgePoints`,
  `pointsBounds`.
- The look of the lines is a THEME, not constants duplicated in the canvas layer:
  `--ne-line-color`, `--ne-line-selected`, `--ne-line-from-sel`, `--ne-line-to-sel`,
  `--ne-line-width` and `--ne-line-hit-width` (declared with their defaults in
  `static/nodditor.css`). The stylesheet turns them into `stroke`/`stroke-width` for the SVG
  layer, and the canvas layer reads the same resolved values off the editor — so a themed
  editor stays themed when it switches layers. The canvas layer re-reads them whenever the
  editor's `class`/`style` attribute changes, so a theme flip re-colours the GPU layer live,
  and any variable it cannot parse (hex, `rgb()`/`rgba()`, a few keywords) falls back to the
  library default instead of drawing something wrong. The pick band is half of
  `--ne-line-hit-width`, so it follows the same theme. See
  [doc/styling-migration.md](doc/styling-migration.md).
- `installCanvasLineLayer(editor, opts)` — probe → build → await `ready` → fall back, in one
  call: resolves with `{ mode, layer, error }` where `mode` is `'canvas'` or `'svg'`, restores
  a working SVG layer when the renderer fails or the device is lost after startup (and then
  calls the host's `onLost`), and accepts `lr` (an already-loaded module), `segmentsPerCurve`,
  `clear`, `supersample` and `device`. The demo toggle now uses it instead of hand-rolling the
  sequence and the SVG fallback.
- `makeCanvasLineLayer` forwards `clear` and `supersample` to the renderer, so a host can opt
  into the supersampled antialiasing path (4x the pixels) or a non-transparent clear without
  reaching for `LineRenderer` directly.
- `loadLineRender()` now separates "not installed" (an expected host choice) from "failed to
  load" (a bug that must not hide behind that message) in its warning, and logs the underlying
  error in both cases.
- A canvas line layer is no longer dead after `dispose()`: `revive()` brings the same layer
  back — same canvas element, re-armed listeners and pixel-ratio watch, the editor's lines
  re-registered, and a fresh GPU session with a fresh `ready` (the disposed life's `ready`
  rejects with an `AbortError`, as before). The editor does it for you: the install path
  revives through `onViewport`/`onResize`, and `setLineLayer(layer)` with the layer that is
  already installed revives it explicitly instead of silently no-op'ing — so a host that
  disposed its active layer no longer ends up with an installed-but-dead one, and a host
  that caches its canvas layer can hand it back rather than build another. `layer.disposed`
  reports whether a layer needs reviving. A generation counter guards the lifecycle: a GPU
  startup or an rAF frame belonging to a disposed life cannot publish over (or draw into)
  the revived one, and the stale session is released instead of leaking. Reviving is refused
  on a destroyed editor. The `LineLayer` contract gained the optional `revive()`, and `add()`
  is now idempotent so a re-install cannot double-subscribe a line.
- Fixed (canvas line layer): the two line layers now agree at every zoom, on the measured
  behaviour rather than the assumed one. The editor's zoom is a CSS transform on
  `.ne-canvas`, which is an HTML **ancestor** of the `<svg>`, and
  `vector-effect: non-scaling-stroke` does not compensate for that — it only compensates
  transforms **inside** the SVG. Measured in Chrome (devicePixelRatio 1, `scale(4)`, a 2px
  stroke): 8 painted px **with** the property and 8 px without, while the same stroke under
  an in-SVG `transform="scale(4)"` painted 2 px with it and 8 px without. The SVG line
  layer has therefore always scaled with zoom, and the canvas layer now matches it:
  `makeCanvasLineLayer` strokes in **world units** (`--ne-line-width`, `worldWidth: true`)
  instead of screen pixels, and its pick band scales with the zoom to mirror the
  `--ne-line-hit-width` hit stroke, which the SVG layer paints inside the same scaled
  canvas. Nothing on a canvas edge depends on the device pixel ratio any more (the
  renderer's viewport carries it), the inert `vector-effect` was dropped from the line
  markup, and `theme.widthCss`/`theme.hitWidthCss` are now `width`/`hitWidth`, since they
  are world units, not screen pixels. A host that wants a zoom-INDEPENDENT thickness
  instead can divide by the zoom the editor publishes — the recipe is in
  `static/nodditor.css` and `src/lineTheme.js`.
- Fixed (@jsx6/line-render): `parseLinePath` silently dropped the `worldWidth` flag, so a
  caller that asked for screen-pixel widths got zoom-scaled world-unit ones instead. The
  flag is carried through now (the geometry the parser returns is otherwise unchanged), and
  both the library tests and `test/lineLayer.test.jsx` lock it down.
- Fixed (canvas line layer): `devicePixelRatio` changes (window moved to another display,
  browser zoom) re-derive the backing store and the renderer viewport (they were only
  derived from the editor's `ResizeObserver`, leaving the canvas blurry and the pick scale
  stale).
- Fixed (canvas line layer): the GPU lifetime races. `dispose()` while `LineRenderer.init()`
  is still in flight left an orphaned device and published a renderer that drew into a
  removed canvas; `ready` also stayed pending forever, so a host awaiting it hung. Now the
  renderer acquired during a dispose is released, and `ready` settles as an `AbortError`
  instead of hanging. A device lost after startup (driver reset, GPU process crash) — or a
  `render()` that throws — stops the redraw loop, releases the renderer and calls the new
  `onLost` option once, so a host can fall back to the SVG layer; the loss raised by the
  layer's own `dispose()` is not reported. The demo wires `onLost` to the SVG fallback.

## 1.0.40
Thu, 25 Apr 2024 11:46:22 GMT

_Version update only_

## 1.0.29
Sun, 17 Sep 2023 14:41:08 GMT

_Version update only_

## 1.0.27
Mon, 05 Jun 2023 13:26:00 GMT

_Version update only_

## 1.0.26
Sun, 04 Jun 2023 09:50:29 GMT

_Version update only_

## 1.0.9
Thu, 11 May 2023 20:56:58 GMT

_Version update only_

## 1.0.4
Thu, 11 May 2023 14:42:10 GMT

_Version update only_

## 1.0.3
Sun, 30 Apr 2023 16:59:17 GMT

_Version update only_

## 1.0.2
Sun, 30 Apr 2023 09:48:12 GMT

_Version update only_

## 1.0.1
Sun, 30 Apr 2023 09:34:35 GMT

_Version update only_

## 1.0.0
Wed, 01 Mar 2023 22:32:14 GMT

_Initial release_

