# Building a host on `@jsx6/nodditor`

This is the ordered path from an empty page to a working editor: what the editor needs from you, what it
does itself, and the four traps hosts actually hit. The complete API reference, the line-layer contract
and the styling variables are in [../README.md](../README.md) — this page is the getting-started version
of it.

Every sample here is injected from [getting-started.example.jsx](./getting-started.example.jsx), which is
a runnable host with assertions (see [Run it](#run-it)).

## 1. Install and load the stylesheet

```sh
bun add @jsx6/nodditor
```

The package ships **no CSS build** but does ship one **required** stylesheet. Without it your blocks are
all stacked in the corner, because the block transform and the canvas are CSS declarations:

```html
<link rel="stylesheet" href="node_modules/@jsx6/nodditor/static/nodditor.css" />
```

That file is geometry (canvas, block transform, zoom controls, marquee, menu) plus a minimal default look.
`static/ne-blocks.css` and `static/ne-demo.css` are the **demo's** look, not part of the contract.

## 2. Create the editor and give it blocks

The editor is the custom element `jsx6-nodditor`. You create it, insert it, and hand it blocks:

[getting-started.example.jsx](./getting-started.example.jsx#region:demo)

```jsx
// A block is any component you hand to `add()`. The element it returns is the block root: the editor
// adds `nid`, the ARIA attributes and the transform, and finds the connectors by walking it.
function Switch({ id, label = 'Switch' }) {
  return (
    <div class="ne-block">
      <div class="ne-title" ne-drag ne-item>
        <b ncid="i1" ne-connect="in" />
        {label || id}
      </div>
      <div class="ne-content">
        <b ncid="o1" ne-connect="out" />
      </div>
    </div>
  )
}

// A factory per block type is what lets the editor rebuild a block from saved data — that is how
// `loadGraph`, undo and redo work. It receives the saved entry, so keep in it whatever you need.
const typeMap = {
  Switch: data => <Switch id={data.id} label={data.label} />,
}

const editor = new NodeEditor({
  typeMap,
  snap: 20, // round block moves to a 20px grid; 0 disables snapping
  style: 'width: 800px; height: 500px; contain: strict',
})
document.body.appendChild(editor)

editor.add(<Switch id="1" />, '1', { type: 'Switch', pos: [30, 10] })
editor.add(<Switch id="2" label="Second" />, '2', { type: 'Switch', pos: [30, 220], label: 'Second' })
editor.addConnectorFromTo('1/o1', '2/i1')
```

What this pins down:

* **A block is your component.** The element you pass to `add(block, id, …)` becomes the block root; the
  editor adds `nid`, `role="group"`, `tabindex` and a stable `aria-label` (`"Switch 1"`), and moves it by
  publishing `--ne-x`/`--ne-y` (never an inline transform).
* **A connector is any descendant with `ncid`** plus `ne-connect="in|out"`. Its global id is
  `` `${blockId}/${ncid}` ``, and discovery is automatic — the editor walks the block whenever its DOM
  changes structurally.
* **`ne-drag` / `ne-nodrag`** mark the drag handle and its exceptions; the editor adds `ne-nodrag` to the
  connectors it found, so dragging a connector draws a line instead of moving the block.

The block root should carry `class="ne-block"` (it is what `position: absolute` is attached to). Use the
`addClass(attr, 'ne-block')` merge idiom so a host-supplied class is not replaced.

## 3. Register a factory per block type

`add(<Switch />, '1', …)` needs no registration — you built the element. But `loadGraph`, undo and redo
rebuild blocks **from saved data**, so every type that can appear in a saved graph needs a factory, and
the factory receives that saved entry:

```jsx
const typeMap = {
  Switch: data => <Switch id={data.id} label={data.label} />, // whatever your markup needs
}
```

Pass it as the `typeMap` option (or call `editor.loadGraph(state, typeMap)`). A missing entry throws
``no factory registered for block type "…"``. Factories must return a **fresh** element per call.

## 4. Wire lines

There are two entry points and the difference matters:

| call | behaviour |
| --- | --- |
| `addConnectorFromTo(a, b)` | strict: throws on an unknown endpoint, a self-connection, or a pair that is already connected **in either direction**. Use it for interactive wiring — or when you want to hear about bad data |
| `loadLines(lines)` | tolerant: attaches what it can, **reports and skips** what it cannot, never throws, returns `{ attached, skipped }`. Use it for data from a server or `localStorage` |
| `loadGraph({ blocks, lines })` | clears first, then does both: rebuild blocks through `typeMap` (scanning each block as it arrives), force one connector inspection, then wire lines |

For **data-driven blocks** — the editor is given the diagram and the host renders each block's markup —
the supported order is render → inspect → wire:

```js
editor.loadGraph({ blocks: diagram.blocks, lines: [] }) // factories render the markup
editor.loadLines(diagram.lines)                          // then the endpoints exist
```

`loadGraph` already inspects after the factories ran. If the markup arrives later (an `await`, a frame, a
render callback), call `editor.inspectConnectors()` (or `recheckConnectors(block, true)`) yourself before
wiring. `addConnectorFromTo` also forces one rescan of the two blocks involved before failing, so lines
wired in the same task as the rendering still connect.

Fan-out (one output to several *different* inputs) is allowed; only a real duplicate throws. If a fill
runs twice, the second run fails on `block id "…" is already in use` — fix the re-run, not the error. The
whole story, with the copy-pasteable `dedupeLines()`/`fillPage()` helpers, is in
[feeding-data.md](./feeding-data.md).

## 5. Persist

```js
const state = editor.saveGraph() // { blocks: [{id, type, pos, …}], lines: [[idFull, idFull]] }
editor.loadGraph(state, typeMap) // → { attached, skipped }
```

* Extra keys you put into a block's data survive into the saved entry and are handed back to the factory.
* **Check `skipped` before writing the state back.** A lossy load that is persisted makes the loss
  permanent (a saved graph with `lines: []` reloads as a connection-less diagram).
* There is **no event for "a line was added"** — `addConnectorFromTo` records history but fires nothing.
  A host that autosaves on `ne-move-done`/`ne-remove` alone will miss every new connection; save on your
  own connect path too.
* `undo()`/`redo()` need `typeMap`, otherwise they warn and return `false`.

## 6. Events, keyboard and teardown

* `ne-move`, `ne-move-done`, `ne-remove` are custom events on the editor element — as a listener
  (`editor.addEventListener('ne-move-done', …)`) or as the JSX attribute `onne-move-done`. The `detail`
  shapes are in [../README.md](../README.md#events).
* Keyboard and pointer behaviour (marquee, pan, connect, nudge, undo/redo, zoom) is documented in
  [../README.md](../README.md#keyboard-and-pointer). Wheel zoom is deliberately not built in.
* `editor.destroy()` disconnects the observers and finalizes every line/block listener. It is called from
  `disconnectedCallback()`, so removing the element from the DOM is enough.

## Traps

| symptom | cause | fix |
| --- | --- | --- |
| all blocks in the corner | the required stylesheet is not loaded | link `static/nodditor.css` (step 1) |
| `unknown connector: "…" does not exist in block …` | the endpoint is not in that block's DOM (wrong `ncid`, or the markup arrived after the scan, or it sits inside a shadow root — the walk does not cross one) | `editor.explainConnectors(blockId)` says per element why it was not collected; then `recheckConnectors(block, true)` |
| `"…" is already connected to "…"` | a duplicate entry in your data, or a fill that ran twice | `loadLines` (tolerant) or de-duplicate — [feeding-data.md](./feeding-data.md) |
| only the first element with an `ncid` is a connector | two elements in one block share the `ncid`; the second one also drags the block | make each `ncid` unique inside the block |
| a line is drawn but never follows its endpoint | connector moves are batched into the editor's `ne-move`, not fired on the connector element | listen on the editor (or use the line layer) |
| nothing happens on wheel | wheel zoom is not built in | wire `editor.changeZoomMouse(delta, event)` |

## Run it

```sh
cd apps/nodditor
node doc/getting-started.run.mjs      # or: bun run docs:getting-started
bun test                              # the editor's unit tests
```

The runner boots happy-dom with the observer stubs happy-dom 14 needs, loads the library stylesheet,
bundles the example with the app's own esbuild settings, and runs it. It works from any working directory.

## Related pages

| page | topic |
| --- | --- |
| [../README.md](../README.md) | the full reference: API, DOM contract, line layers, styling, testing |
| [feeding-data.md](./feeding-data.md) | `loadGraph`/`loadLines`, the duplicate-line error and the dedupe helpers |
| [zoom-controls.md](./zoom-controls.md) | the built-in zoom UI and how to build your own |
| [styling-migration.md](./styling-migration.md) | the `--ne-*` custom properties and the theming contract |
| [static/vanilla/README.md](../static/vanilla/README.md) | the same host written with no JSX, no signals and no framework |