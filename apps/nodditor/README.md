# @jsx6/nodditor

A blocky node-graph editor built on [JSX6](../../libs/jsx6). Blocks are JSX6 components you provide;
the editor places them on a zoomable/pannable canvas, discovers their connectors, draws the lines
between them, and handles selection, drag-connect, keyboard editing and undo/redo.

The package ships **raw source** (`index.js`, `src/`) plus generated type declarations (`dist/`).

## Run the demo

From the repository root ([README.dev.md](../../README.dev.md) covers the toolchain — Bun 1.3.14+):

```bash
bun install --frozen-lockfile
cd apps/nodditor
bun start                    # node src_build/build.js --dev
```

That starts **live-server on <http://127.0.0.1:5111>** (`static/` is copied to `build_dev/`, the
bundle is rebuilt on change and the page live-reloads). The demo graph is the one hardcoded in
[src/index.jsx](src/index.jsx) — two `Switch` blocks and two `Message` blocks — and it persists to
`localStorage` (`ne.graph`) on every `ne-move-done` / `ne-remove`. A toggle at the bottom-left
switches the line rendering between the default SVG layer and the WebGPU canvas layer
(`@jsx6/line-render`, optional — see [Line layer](#line-layer)).

Other scripts, all run from `apps/nodditor`:

| Command | What it does |
| --- | --- |
| `bun start` | dev server on :5111 (watch + live reload) |
| `bun run build` | production bundle + `static/` copy into `build/` (`BUILD SUCCESS` on stdout) |
| `bun run tsc` | regenerate `dist/` (declarations only — `emitDeclarationOnly`) |
| `bun test` | unit tests in [test/](test/), DOM globals from happy-dom (see [Testing](#testing)) |

## Usage

```jsx
import { NodeEditor } from '@jsx6/nodditor'
import { insert } from '@jsx6/jsx6'

const editor = (
  <NodeEditor
    class="fxs1 fx1"
    typeMap={{ Switch: ({ id }) => <Switch id={id} /> }} // renders a block from its data; used by
                                                          // loadGraph / undo / redo (see below)
    menu={() => menuElement}                 // selection menu generator (see below)
    zoomMin={0.3}
    zoomMax={4}
    snap={20}                                // 0 = free movement
    nudgeStep={10}                           // arrow-key step (Shift = 5x)
    onne-move-done={() => save()}
    onne-remove={() => save()}
    style="width: 800px; height: 500px; contain:strict"
  />
)

insert(document.body, editor)

editor.add(<Switch />, '1', { pos: [30, 10], type: 'Switch' })
editor.add(<Switch />, '2', { pos: [30, 220], type: 'Switch' })
editor.addConnectorFromTo('1/o1', '2/i1')
```

`NodeEditor` is the custom element `jsx6-nodditor`; its template options are:

| Option | Default | Meaning |
| --- | --- | --- |
| `menu` | `null` | `blocks => HTMLElement`, called for every selection change |
| `zoomMin` / `zoomMax` | `0.3` / `4` | zoom clamp (zoom above 100% is allowed) |
| `snap` | `0` | grid size block moves are rounded to, `0` disables snapping |
| `nudgeStep` | `10` | arrow-key nudge in content units (Shift multiplies by 5) |
| `typeMap` | `null` | block-type → factory, used by `loadGraph` and therefore undo/redo |

The selection menu is positioned **by the editor** (`moveMenu` centers it above the selection), so the
generator only has to return the element and set `position: absolute`. A menu can take over its own
placement by defining `menu.moveMenu(blocks, menu)`; [src/index.jsx](src/index.jsx) is the reference
implementation.

### Public API

Blocks and connectors:

- `add(block, id, { pos = [0, 0], type = '' })` → `BlockData` — inserts the block element (wrapped in
  the `ne-block` container it carries), discovers its connectors and pushes an undo entry. Throws when
  `id` is already in use.
- `getBlockData(idOrNodeOrBlockData)` → `BlockData`, `getPos(id)`, `getMinXY()`
- `removeBlock(blockData)`, `deleteBlocks(blockArray)`, `deleteSelectedBlocks()`, `clear()`
- `getConnector(blockId, cid)` — `blockId` may be `"1"`, `"1/o1"` or `["1", "o1"]`
- `addConnectorFromTo(c1, c2)` → `ConnectLine` — same id forms. Throws on an unknown connector, a
  self-connection, or a pair that is already connected (in either direction). Use `lineExists(a, b)`
  to test without throwing.
- `removeLine(line)`, `removeConnector(con)`, `lineHasConnector(con)`

Selection:

- `selectBlocks(blockArray)` — sets `selectedBlocks`, shows/positions the menu, updates the `selected`
  attribute and the `aria-label` of each block. Selection is state, not part of the accessible name,
  so the label never changes with selection.
- `selectConnector(line)`, `selectAll()`, `toggleBlockSelection(block)`, `deselect()`
- `deleteSelection()` — removes the selected line, otherwise the selected blocks
- `blocksInRect(x1, y1, x2, y2)` — marquee hit test (touching counts as inside)

View:

- `changeZoom(delta, x = 0, y = 0)` — zoom around a point in editor-relative client pixels
- `changeZoomMouse(delta, event)` — zoom around the pointer; `changeZoomCenter(delta)` — around the middle
- `zoomTo(zoom)` — absolute zoom, clamped and centered; `zoom` getter/setter
- `moveAll(dx, dy)`, `setPos(id, pos)`, `setZoomAndPos(zoom, x, y)`, `resetView(padx = 30, pady = 30)`
- `contentPoint(clientX, clientY)` — client coordinates → content-area coordinates (zoom-aware)

Persistence and history:

- `saveGraph()` → `{ blocks: [{id, type, pos}], lines: [[idFull, idFull]] }`
- `loadGraph(state, typeMap = this.typeMap)` — clears the editor and rebuilds it (needs the block
  factories); resets the undo baseline
- `undo()`, `redo()` — both need `typeMap`, otherwise they warn and return `false`
- `historyReset()`, `historyRecord(kind)` — snapshots the graph; only a real change is recorded

Lifecycle:

- `destroy()` — disconnects the observers and finalizes every line/block listener. Called
  automatically from `disconnectedCallback()`, so removing the element from the DOM is enough.

## Block / connector DOM contract

A **block** is a JSX6 component passed to `add(block, id, …)`; the element you hand in becomes the
block root — the editor does not wrap it. The block component adds the `ne-block` class
(`class="ne-block"`, only needed for styling: `.ne-block` is `position: absolute`) and the
editor adds:

| Attribute | Meaning |
| --- | --- |
| `nid` | the block id given to `add` — how the editor maps DOM back to `BlockData` |
| `ne-drag` | this subtree is a drag handle: pointerdown here starts a block drag |
| `ne-nodrag` | this subtree does *not* drag (clicking it deselects instead) |

The root also gets `role="group"`, `tabindex="0"` and an `aria-label` of
`` `${type} ${id}` `` (+ `selected`), and is moved with `transform: translate(x, y)`.

A **connector** is any descendant element with an `ncid`, e.g.:

```jsx
<div class="ne-title" ne-drag ne-item>
  <b ncid="i1" ne-connect="in" />
  {title}
</div>
<div class="ne-content">
  <b ncid="o1" ne-connect="out" />
</div>
```

| Attribute | Meaning |
| --- | --- |
| `ncid` | the connector's name **inside the block**; the global id is `` `${blockId}/${ncid}` `` |
| `ne-connect` | `in` or `out` — connection direction (dragging only starts from an `out`) |

Discovery is automatic (recursively, on every structural DOM change), and the editor adds
`ne-nodrag` to each connector so dragging it draws a line instead of moving the block. Optional CSS
custom properties `--offset-x` / `--offset-y` shift the line endpoint relative to the connector box
(the demo styles this in [static/ne-blocks.css](static/ne-blocks.css)).

**When discovery runs — and when to force it.** Connector discovery is memoized per block (it is
what keeps a resize of a 200-block graph cheap): a block is re-walked when the canvas
`MutationObserver` reports a structural change to it, when `add()` registers it, and once more when
the editor is attached to the document (mutations made while it was detached are not observable).

For **data-driven blocks** — the editor is given the diagram, the host renders each block from that
data, and the connectors only exist afterwards — the safe order is:

1. `loadGraph({ blocks, lines: [] })` or `add()` per block; the editor scans each block as it
   arrives. Connectors that do not exist yet simply are not discovered.
2. Render the blocks' connectors into their elements.
3. Call `addConnectorFromTo(idFull1, idFull2)` per line. If an endpoint is not in the map yet, the
   editor **forces one rescan of the two blocks involved** before failing, so lines wired in the same
   task as the rendering still connect.

If you would rather be explicit (or you changed a block's DOM in a way the observer cannot see, e.g.
while the block was detached), force it yourself:

```js
const block = editor.add(<MyBlock />, '1', { type: 'MyBlock' })
myRenderer(block.el) // fills in the connectors synchronously
editor.recheckConnectors(block, true) // walk that block's subtree now
editor.addConnectorFromTo('1/o1', '2/i1') // safe: both connectors are in the map
```

`recheckConnectors(blockData)` without `force` is a no-op for an unchanged block — by design, and
asserted by the P3 smoke suite (`P3-1 recheck of an unchanged block walks ZERO elements`). Deferring
instead also works: after a microtask the observer has marked the block dirty and the rescan happens
on its own. An `unknown connector` error therefore means the endpoint genuinely does not exist in
that block's DOM (wrong `ncid`, or connectors nested inside a shadow root, which the walk does not
cross).

### Registering custom blocks

The editor never builds block markup. **Rendering a block from the given data is the host's job**, and
a factory is how the editor asks for it. Two independent things are involved:

1. **Instantiation** — `add(<MyBlock data={data} />, id, { type: 'MyBlock' })` takes the element
   directly, so no registration is needed for the block you create by hand.
2. **Rebuilding** — `loadGraph` (and with it undo/redo and the demo's `localStorage` restore) has the
   saved entry per block, so every `type` that can appear in a saved graph needs a factory. The
   factory receives **that entry** — the whole `{id, type, pos, …}` object, including any extra keys
   your own `saveGraph` produced:

   ```jsx
   const typeMap = {
     Switch: ({ id, type, label }) => <Switch id={id} label={label} />, // your markup, your data
     Message: ({ id }) => <Message id={id} />,
   }

   <NodeEditor typeMap={typeMap} />
   ```

   Factories must return a **fresh** element per call — `loadGraph` calls one per block. A missing
   entry throws `` no factory registered for block type "…" ``.

### Data-driven blocks: render → inspect → wire lines

This is the order the library is built for, and the reason `typeMap` factories receive their block's
data: the connectors live in **your** markup, so the editor can only know them after you have
rendered it.

```js
// 1. blocks: the typeMap factories render each block's own markup from its data
editor.loadGraph({ blocks: diagram.blocks, lines: [] })

// 2. inspect: discover the connectors that markup produced
const connectors = editor.inspectConnectors() // [{ blockId, id, idFull, dir, el }, …]
//    editor.getConnectors(blockId) gives one block's Map when you need a narrower look

// 3. lines: now they can be attached
editor.loadLines(diagram.lines)
```

* `loadGraph` performs step 2 for you (before it wires any line), so a synchronous factory needs no
  extra call. Call `inspectConnectors()` yourself when the block markup arrives later — after an
  `await`, a frame, or a render callback — and then call `loadLines(lines)`.
* Both inspection calls **force** a scan, so they work no matter what the `MutationObserver` has or
  has not seen.
* `addConnectorFromTo(from, to)` remains the strict, one-line API (it throws on a bad endpoint); use
  it for interactive wiring.

#### Wiring lines from your own data: use `loadLines`, not a `forEach(addConnectorFromTo)`

The error hosts hit most often is a duplicate line in their own data:

```
Uncaught Error: NodeEditor: "1/onTimeout" is already connected to "2/i1"
    at NodeEditor.addConnectorFromTo
    at editorUtils.js:31   ← a forEach over page.conns
```

That guard is correct — fan-out (one output to several different inputs) is allowed, so it only fires
when the pair really is already connected, either because the same entry appears twice (in either
direction) or because the fill ran again over a graph that still had its lines.

`loadLines` is the loader for this: it attaches what it can, **reports and skips what it cannot, and
never throws**, returning `{ attached, skipped }`.

```js
setTimeout(() => {
  const { attached, skipped } = editor.loadLines(page.conns) // not forEach(addConnectorFromTo)
  if (skipped) console.warn(`nodditor: ${attached} attached, ${skipped} skipped`)
}, 200)
```

If the whole graph comes from the server, prefer one authoritative call — `loadGraph` clears first, so
running it twice is harmless: `editor.loadGraph({ blocks, lines })`. Full guide with the de-duplication
snippet and a readiness check for async ports: [doc/feeding-data.md](doc/feeding-data.md).

#### Corrupt data must not cost the document

`loadLines` (and therefore `loadGraph`) is **tolerant**: a line whose endpoint does not exist, is a
duplicate, or connects a connector to itself is reported to the console and skipped, while the
remaining lines still attach. It returns `{ attached, skipped }`.

```
NodeEditor: skipping line ["1/does-not-exist","2/in"] — NodeEditor: unknown connector:
  "1/does-not-exist" does not exist in block "1" (type "Custom"); discovered there: "in", "out"
```

The message names the block, its type, and the connectors that *were* discovered — usually enough to
see the data problem (a stale `ncid`, a block whose markup changed) without debugging the editor.

#### "My connector does not show up"

`editor.explainConnectors(blockId)` walks the block element for `[ncid]` exactly like discovery does
and reports, per element, whether the editor collected it and why not:

```js
editor.explainConnectors('onTimeout-block')
// [ { ncid: 'onTimeout', collected: true,  dir: 'out', tag: 'B' },
//   { ncid: 'onTimeout', collected: false, dir: 'out', tag: 'B',
//     note: 'duplicate ncid — another element holds it' } ]
```

The three causes it distinguishes:

| report | cause | fix |
| --- | --- | --- |
| `duplicate ncid — another element holds it` | two elements in one block carry the same `ncid`. Only the **first** becomes the connector; the second is not collected and also does not get `ne-nodrag`, so it drags the block instead of starting a line | make each `ncid` unique inside the block |
| `not collected by the last scan` | the element is in the block but discovery has not seen it — its DOM was added in a way the canvas `MutationObserver` cannot observe | `editor.recheckConnectors(block, true)`, or call `inspectConnectors()` after rendering |
| the element is missing from the report entirely | it is **not inside the block element** the editor was given, or it lives inside a shadow root (the walk does not cross shadow boundaries) | add it to the block element, or avoid the shadow root |

`ncid` values are arbitrary strings: camelCase (`onTimeout`), dots, hyphens, digits and leading
slashes all work — `getAttr` is used verbatim, so discovery reads the attribute exactly like
`getAttribute('ncid')`.

## Events

All three are custom events fired on the editor element (and on the connector element for
`ne-remove`), so `editor.addEventListener('ne-move', …)` — or the `onne-move` JSX attribute — works.

| Event | `detail` | When |
| --- | --- | --- |
| `ne-move` | block: `{ nid, left, top, pos, domNode }` | a block moved (also for a group drag: the primary block) |
| `ne-move` | connectors: `{ stamp, connectors }` | one event per batch of connector moves; each entry of `connectors` is a `{...ConnectorData}` snapshot and `con.movedStamp === stamp` identifies the ones in this batch in O(1) |
| `ne-move-done` | `{ nid, left, top, pos, domNode }` or `null` (zoom) | drag/nudge/resize finished; the undo snapshot is taken now |
| `ne-remove` | `{...ConnectorData}` | a connector element left the DOM (its lines are removed too) |

A connector move is **not** fired on the connector element any more (P3-2): it arrives inside the
batched `ne-move` of the editor. `ConnectLine` already consumes that shape, which is why lines follow
their endpoints without extra work.

## Keyboard and pointer

- **Left drag on a block** (`ne-drag`) moves the selection; **Shift/Ctrl-click** toggles a block in
  the selection; **left drag on empty canvas** draws a marquee; **middle button or Alt+left drag**
  pans the canvas.
- **Delete / Backspace** removes the selection (ignored while an in-place title has focus);
  **Ctrl+A** selects all, **Esc** clears, **Ctrl+Z** / **Ctrl+Shift+Z** / **Ctrl+Y** undo/redo,
  **Ctrl +** / **Ctrl -** / **Ctrl 0** zoom, **arrows** nudge (Shift = 5x).
- **Drag from an `out` connector** draws a new line; dropping it on an `in` connector connects,
  dropping it anywhere else discards the line. Selecting a line exposes its endpoints for re-pointing.
- Wheel zoom is not built in — wire it up yourself (see [notes.md](notes.md) for the three zoom entry
  points):

  ```jsx
  onwheel={e => {
    e.preventDefault()
    editor.changeZoomMouse(e.deltaY > 0 ? -0.1 : 0.1, e)
  }}
  ```

- The bottom-right **zoom controls** ("-", percentage/reset, "+") ship with the editor; their
  defaults, CSS and stacking are documented in [doc/zoom-controls.md](doc/zoom-controls.md).

## Replacing the backend

The editor is written against a small backend contract instead of the `@jsx6` packages directly.
[src/runtime-default.js](src/runtime-default.js) is the **only** module in the package that imports
`@jsx6/*`; everything else reads through `backend.current` and is enforced by
[test/runtime.test.js](test/runtime.test.js).

`setRuntime()` installs a replacement. A partial object is merged over the default, so swapping one
primitive is a one-liner; pass `null` to go back to the default backend.

```js
import { backend, setRuntime } from '@jsx6/nodditor/src/runtime.js'

const defaults = backend.current
setRuntime({
  fireCustom: (el, name, detail) => el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true })),
  classIf: (node, name, on) => node.classList.toggle(name, !!on),
})
// … import the editor only now …
```

Three things to know:

- **Install the replacement before importing the editor.** `NodeEditor` extends `backend.current.JsxW`
  when its module is evaluated, so a later swap would leave the editor on the old base class.
- **Some primitives are not one-liners.** `addClass` receives a props **object** from the block
  components and must extend its `class` string (`{ class: 'host' }` → `'host ne-block'`), not just
  call `classList.add`; a replacement that only handles elements silently drops the editor's own
  `ne-block` class. `insert`/`toDomNode` likewise normalise components (`.el`) and arrays.
  The smoke suite asserts the merge explicitly (`SEAM-6 a host class is merged, not overwritten`).
- **The JSX runtime is bound at build time**, not through this seam: JSX compiles to
  `@jsx6/jsx-runtime` (see [src_build/buildScript.js](src_build/buildScript.js)). A standalone build
  points `jsxImportSource` at its own runtime, which needs no source change.

The full contract is the `NodeEditorRuntime` typedef in [src/runtime.js](src/runtime.js) — 21 names.
[smoke/essential.smoke.js](smoke/essential.smoke.js) measures which of them a real, framework-free
session actually calls; the rest are reached only through pointer/keyboard paths or are structural.
See [Which parts of the backend are essential](#which-parts-of-the-backend-are-essential), and
[plan/odditor-jsx6-dependency-inventory.md](../../plan/odditor-jsx6-dependency-inventory.md) for the
per-primitive inventory and the thinning plan.

## Line layer

Lines are drawn by a pluggable **line layer**; the editor talks to it through one small contract
instead of reaching into the DOM. The default is the SVG layer ([src/lineLayer.js](src/lineLayer.js)):
line `<g>` elements live in `editor.svgLayer` and selection state lands as classes
(`selected` / `ne-from-sel-block` / `ne-to-sel-block`) — the pre-refactor behaviour.

```js
editor.lineLayer          // the active layer
editor.setLineLayer(layer) // swap the active layer
```

`setLineLayer` takes every line off the old layer **before** disposing it (on the SVG layer that
detaches the line `<g>`s, so the replacement layer must not draw them a second time), then
re-adds the lines on the new layer and replays the current selection and view state
(`onViewport(zoom)`, `onResize(w, h)`). Swapping to the same layer, or after `destroy()`, is a no-op — with one exception: passing the layer
that is already installed gives it the chance to come back from its own `dispose()` (see the
`revive()` row below), so a layer a host disposed in place does not stay installed-but-dead.

A layer implements:

| Member | Meaning |
| --- | --- |
| `kind` | `'svg'` or `'canvas'` |
| `el` | the layer element (the `svgLayer` for SVG, the canvas for the WebGPU layer) |
| `add(line)` / `remove(line)` | put a `ConnectLine` on / off the layer (`add` is idempotent) |
| `setStates(line, selected, fromSel, toSel)` | selection state for one line |
| `pick(clientX, clientY)` → line or `null` | line hit test (client coordinates) |
| `onViewport(zoom)` | zoom changed (pan is 0 — the canvas scales from its top-left corner) |
| `onResize(cssW, cssH)` | canvas area changed |
| `ready` (canvas layers) | promise that resolves when the renderer is usable; rejects when WebGPU is unavailable/the renderer cannot start, or if the layer is disposed while it is still initialising (never left pending). It is a fresh promise per life, so a revived layer has a new one |
| `dispose()` | release everything the layer owns; it may be terminal or not, depending on the layer |
| `revive()` (optional) | undo `dispose()` and make the layer usable again. The SVG layer owns nothing, so it needs none; the canvas layer releases its GPU session + canvas element and comes back through this. The editor calls it for you: `onViewport`/`onResize` (the re-install path) revive first, and `setLineLayer(activeLayer)` revives explicitly |

The editor calls these on every relevant event — `addConnector`/`removeLine`, `selectBlocks` /
`selectConnector`, the zoom setter, and the resize observer — so a custom layer is all that a host
has to provide.

### WebGPU canvas layer (optional dependency)

`@jsx6/line-render` is an **optional** dependency: the package works without it. It contributes the
canvas layer ([src/canvasLineLayer.js](src/canvasLineLayer.js)), which draws every connector on a
canvas with a WebGPU `LineRenderer` and picks lines with `pickEdge`:

```js
import { loadLineRender, makeCanvasLineLayer } from '@jsx6/nodditor'

const lr = await loadLineRender() // dynamic import; null (with a console warning) when the
                                   // package is not installed
if (lr?.LineRenderer.isSupported()) {   // synchronous probe: skip the whole attempt without WebGPU
  const layer = makeCanvasLineLayer(editor, lr, {
    // a device lost after startup (driver reset, GPU process crash) is the same
    // story as a failed init: fall back to the SVG layer
    onLost: () => editor.setLineLayer(createSvgLineLayer(editor)),
  })
  editor.setLineLayer(layer)
  await layer.ready.catch(() => editor.setLineLayer(createSvgLineLayer(editor)))
}
```

Degradation: the layer probes with `LineRenderer.isSupported()` first and rejects `ready` when the
browser has no WebGPU; otherwise `LineRenderer.create()` reports the cause to the console, releases
what it half-acquired and resolves with `null`, and `ready` rejects on that too. Either way `pick`
keeps working (the picking is pure curve math) and `dispose()` is quiet — the demo page falls back
to the SVG layer and shows a disabled toggle. `ready` also rejects when the layer is disposed while
the GPU is still coming up, so a host awaiting it can never be left hanging. A device lost after
startup is reported once through `onLost` (drawing stops and the renderer is released first); `pick`
keeps working there too, and the loss raised by the layer's own `dispose()` is not reported.
Selection colours mirror the CSS rule order
(to-selected > from-selected > selected > base black), and the pick radius mirrors the SVG hit
path (4 px, like half of the 8 px transparent hit stroke).

Disposal is not the end of a canvas layer: `dispose()` releases the GPU session, the editor-level
listeners, the pixel-ratio watch and the canvas element, and `revive()` puts all of it back on a
**new** GPU session — with a **new** `ready`, because the `ready` of the disposed life has already
rejected with an `AbortError` when it was still pending. A host can therefore keep its canvas layer
and hand it back instead of building another one:

```js
editor.setLineLayer(createSvgLineLayer(editor)) // disposes the canvas layer (its GPU is released)
// ... later
editor.setLineLayer(canvasLayer) // revives it: fresh GPU session, lines re-registered, drawings back
```

The editor drives this itself: the install path calls `onViewport`/`onResize` first and those
revive, and `setLineLayer(layer)` with the layer that is **already installed** revives it explicitly
(so a host that disposed the active layer does not leave a dead one in place). `layer.disposed` says
whether a layer needs reviving, and the whole lifecycle is guarded by a generation counter — a GPU
startup or an rAF frame belonging to a disposed life can neither draw into the revived layer nor
publish a renderer over it, and the stale GPU session is released instead of leaking. `revive()`
does nothing on a destroyed editor, where nothing would ever release the new session.

Geometry: the canvas element covers the editor box in CSS pixels and its backing store is
`editor box × devicePixelRatio`; the renderer viewport is `zoom × dpr` with pan `(0, 0)` (the editor
canvas scales from its top-left corner and panning moves the blocks). A change of
`devicePixelRatio` — another display, browser zoom — re-derives both, so the lines do not go blurry
and picking stays under the pointer.

GPU lifetime and device ownership: by default the layer lets the renderer request its own
`GPUDevice`, so **one canvas layer per editor means one device per editor** (the SVG layer owns
none, and so does a layer that never got past `ready`). A host that installs several editors can
share ONE device instead by passing it in — the layer forwards it to
`LineRenderer.create()`:

```js
const adapter = await navigator.gpu.requestAdapter()
const device = await adapter.requestDevice()
// every editor's layer borrows the same device; each still owns its canvas context
const layerA = makeCanvasLineLayer(editorA, lr, { device })
const layerB = makeCanvasLineLayer(editorB, lr, { device })
// ... dispose the layers/editors first, then the device (a borrowed device is never
// destroyed by `dispose()`, which is what makes the sharing safe)
device.destroy()
```

A borrowed device is not destroyed by `dispose()` — including the one `setLineLayer` performs when
it swaps the layer out — and a device lost or destroyed by its owner is reported to every layer
using it through `onLost`. See "Device ownership and sharing" in the
[`@jsx6/line-render` README](../../libs/line-render/README.md#device-ownership-and-sharing).

A line **being connected** is drawn too: while its free end follows the pointer during a drag
(its `d` is recomputed by `ConnectLine.updatePath`, `p2.con` still null) the canvas layer has
subscribed to `ConnectLine.onPathChange`, so the temporary connector tracks the pointer exactly
like the SVG layer does. Redraws are rAF-batched — per frame the cost is one `parseLinePath` per
line plus one instanced GPU draw, the same budget as the `ne-move`/zoom redraw path: no per-event
render, no per-line canvas, no buffer churn.

The demo page ([src/index.jsx](src/index.jsx)) ships a **SVG / canvas toggle** (bottom-left) that
switches the live editor between the two layers with the graph, selection and zoom intact.
`test/lineLayer.test.jsx` covers both layers and the swap, using the real `parseLinePath` /
`pickEdge` and a fake `LineRenderer` (happy-dom has no WebGPU).

## Vanilla demo

[static/vanilla/](static/vanilla/README.md) is a host built with **no JSX, no component framework and
no signals** — plain DOM blocks, a JSON graph in `localStorage`, and the editor's public API. It is
the reference for the host contract, and the smallest thing that is actually usable.

```bash
cd apps/nodditor
bun run build:vanilla          # bundles into build_vanilla/ (+ the stylesheets it needs)
bun run start:vanilla          # dev build of just the vanilla demo
```

## Which parts of the backend are essential

`smoke/essential.smoke.js` runs the vanilla demo under happy-dom with a recording backend and prints
every primitive the editor reaches for. In a session that covers load/save, add, connect, move,
select, delete, undo/redo, zoom and teardown, **18 of the 21 contract names are called**:

| called | not called by that session | why the rest exist |
| --- | --- | --- |
| `addClass` `runFuncNoArg` `getAttr` `isNode` `listen` `fireCustom` `classIf` `listenCustom` `setAttribute` `hSvg` `insert` `observeShowHide` `remove` `setSelected` `toDomNode` `setVisible` `$Or` `observeNow` | `JsxW` `define` `findParent` | `JsxW`/`define` are structural (`extends` + the class static block); `findParent` is used by pointer/click handlers |

Conclusions from that measurement:

- **The contract carries only what the editor and its block components call.** The demo page
  (`src/index.jsx`) uses the editor's public API and plain DOM, so `src/runtime-default.js` is the
  only module in the package that imports jsx6 — asserted for every file, with no exemptions, by
  `test/runtime.test.js` and the `SEAM-1` check in the smoke suite.
- **Not every primitive is a one-liner.** `addClass` is the counter-example: it takes a props
  *object* and merges a `class` string (see [static/vanilla/README.md](static/vanilla/README.md) and
  §1.0 of the inventory). The vanilla demo does not need it — its blocks are plain DOM with their own
  class — but the JSX block components do, and a naive replacement breaks host-supplied classes.
- **`$Or`/`observeNow` are used exactly once** — for the `.focused` class on the canvas. They are the
  only reason the editor depends on `@jsx6/signal`, and replacing them with a local two-line helper
  would drop that dependency entirely. Same for `observeShowHide` in `connectorUtil.js`, which is the
  only reason for `@jsx6/dom-observer`.

## Styling

> **Upgrading from a version whose blocks were positioned with inline styles?** Your blocks will all
> sit in the corner until the stylesheet is loaded — it is a required dependency now. See
> [doc/styling-migration.md](doc/styling-migration.md) for the one-line fix and the full list of
> changes.

The package ships no CSS *build*, but it does ship one **required** stylesheet:
[static/nodditor.css](static/nodditor.css). It contains the geometry the editor needs — the canvas,
the block transform, the zoom controls, the marquee, the selection menu — and a minimal default look
for the controls the editor creates. Link it (or paste it, or `@import` it):

```html
<link rel="stylesheet" href="node_modules/@jsx6/nodditor/static/nodditor.css" />
```

[static/ne-blocks.css](static/ne-blocks.css) and [static/ne-demo.css](static/ne-demo.css) are the
**demo's** look only (block chrome, menu chrome, the demo editor box) — an app brings its own.
`static/NodeEditor.css` is a deprecated two-line shim that `@import`s both, kept so an existing
`<link>` keeps working.

**The editor writes no inline styles.** Everything dynamic is published as a CSS custom property, and
the stylesheet turns it into layout. That means a host can see, override or re-anchor any of it from
CSS, and nothing depends on a declaration the editor injected at runtime:

| element | variables | consumed by |
| --- | --- | --- |
| canvas (`.ne-canvas`) | `--ne-zoom` (unitless), `--ne-zoom-w`, `--ne-zoom-h` | `transform: scale(…)`, size |
| block (`.ne-block`) | `--ne-x`, `--ne-y` | `transform: translateX() translateY()` |
| selection menu (`.ne-menu`) | `--ne-menu-x`, `--ne-menu-y` | `left`, `top` |
| marquee (`.ne-marquee`) | `--ne-marquee-x/-y/-w/-h` | `left`, `top`, `width`, `height` |
| stacking (override only) | `--ne-content-z`, `--ne-zoom-z`, `--ne-marquee-z` | `z-index` |

All of them have defaults (`0px`, `scale(1)`), so an override is a plain CSS declaration:

```css
jsx6-nodditor {
  --ne-zoom-z: 5; /* lift the zoom controls above a host overlay */
}
```

**No accessibility markup on lines.** Lines are not focusable and carry no `role`/`tabindex`/
`aria-label` — a focusable `<g>` is what made browsers (or a host `:focus` rule) draw a gray box
around a selected line, duplicating the `.selected` stroke. Blocks keep `role="group"`, `tabindex`
and a stable `aria-label` (`"Switch 1"`) because the keyboard flow (Enter to select, arrows to nudge,
Delete to remove) depends on them.

## Testing

Unit tests live in [test/](test/) and run through Bun's test runner:

```bash
cd apps/nodditor
bun test
```

Or use `bun run test` at the repository root, which runs `bun test` per package with the cwd set to
the package — that is what [scripts/verify.js](../../scripts/verify.js) does. Do **not** rely on
`bun test apps/nodditor` from the root: Bun resolves `bunfig.toml` from the process cwd, so the app's
`jsxImportSource` would not be applied and the JSX in the sources would not transform.

- [test/setup.js](test/setup.js) registers the happy-dom globals and stubs `IntersectionObserver`
  (happy-dom 14 has no implementation, and `@jsx6/dom-observer` constructs one). Every DOM-level test
  file imports it **first**, because the editor extends `HTMLElement` at module-evaluation time.
- [test/pure.test.js](test/pure.test.js) — the DOM-free helpers: `getBlocksBounds`,
  `getBlocksMinXY`, `calcPos`, `makeLineConnector`, `pairUtils`.
- [test/editor.test.jsx](test/editor.test.jsx) — the data model through the real editor: `add`,
  `getConnector`, `addConnectorFromTo` (duplicate rejection), `selectBlocks`, and Delete/Backspace.
- [test/runtime.test.js](test/runtime.test.js) — the backend seam (see
  [Replacing the backend](#replacing-the-backend)): `src/runtime-default.js` is the only module
  allowed to import a `@jsx6/*` package, the contract has a fixed surface, and `setRuntime()`
  replaces it.
- [test/lineLayer.test.jsx](test/lineLayer.test.jsx) — the line layer (see
  [Line layer](#line-layer)): the default SVG layer, the canvas layer with a fake `LineRenderer`
  around the real `parseLinePath`/`pickEdge`, picking, viewport/resize flow, and `setLineLayer`
  swaps.
- [bunfig.toml](bunfig.toml) sets `jsxImportSource = "@jsx6"` so `bun test` can transform JSX at all
  (the default runtime is react).
- `smoke/*.smoke.jsx` are script-style suites, deliberately **not** named `*.test.jsx` so that
  `bun test` never picks them up: they need the DOM globals and the bundling done by their own
  runner:

```bash
cd apps/nodditor
node smoke/p1.run.mjs        # P1: robustness; also p2.run.mjs, p3.run.mjs
node smoke/seam.run.mjs      # the backend seam: a real editor on a replaced backend
```

Each runner bundles the real sources with esbuild (the same settings as the app build) into
`smoke/pN.bundle.mjs`, so the suites exercise the built code path rather than a test-only entry
point. Those generated bundles are excluded from Oxfmt in [.oxfmtrc.json](.oxfmtrc.json).
`smoke/seam.smoke.jsx` covers what `test/runtime.test.js` cannot: it boots a real editor whose
backend is a replacement and asserts the editor's calls actually arrive there.

## Formatting and the local gate

Format with `bun run format` from the repository root (Oxfmt is canonical). `bun run check` is the
full local gate; note that it type-checks and lints `libs/`, `tools/` and `scripts/` only —
`apps/nodditor` is verified by `bun run build`, `bun test` and the demo. After any public API change
regenerate the declarations with `bun run tsc`.
