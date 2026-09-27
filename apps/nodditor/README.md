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
`localStorage` (`ne.graph`) on every `ne-move-done` / `ne-remove`.

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
    typeMap={{ Switch: () => <Switch /> }}   // block factories for loadGraph / undo / redo
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
  attribute, the `aria-label` of each block and the `aria-live` status text.
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
(`addClass(attr, 'ne-block')`, only needed for styling: `.ne-block` is `position: absolute`) and the
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

### Registering custom blocks

Two independent things are involved:

1. **Instantiation** — `add(<MyBlock />, id, { type: 'MyBlock' })` takes the element directly, so no
   registration is needed for the block you create by hand.
2. **Rebuilding** — `loadGraph` (and with it undo/redo and the demo's `localStorage` restore) only has
   `{id, type, pos}`, so every `type` that can appear in a saved graph needs a factory:

   ```jsx
   const typeMap = {
     Switch: () => <Switch />,
     Message: () => <Message />,
     MyBlock: () => <MyBlock />,
   }

   <NodeEditor typeMap={typeMap} />
   ```

   Factories must return a **fresh** element per call — `loadGraph` calls one per block. A missing
   entry throws `` no factory registered for block type "…" ``.

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
  addClass: (node, name) => node.classList.add(name),
})
// … import the editor only now …
```

Two things to know:

- **Install the replacement before importing the editor.** `NodeEditor` extends `backend.current.JsxW`
  when its module is evaluated, so a later swap would leave the editor on the old base class.
- **The JSX runtime is bound at build time**, not through this seam: JSX compiles to
  `@jsx6/jsx-runtime` (see [src_build/buildScript.js](src_build/buildScript.js)). A standalone build
  points `jsxImportSource` at its own runtime, which needs no source change.

The full contract is the `NodeEditorRuntime` typedef in [src/runtime.js](src/runtime.js) — 23 names,
of which the editor itself drives at most 19.

## Styling

The package ships no CSS: the demo's styles are static assets, not part of the API.
[static/NodeEditor.css](static/NodeEditor.css) contains the structural bits (block focus ring,
marquee rectangle, zoom UI, `aria-live` status) and [static/ne-blocks.css](static/ne-blocks.css) the
demo block/connector look.

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
