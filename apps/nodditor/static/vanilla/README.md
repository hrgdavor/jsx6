# Vanilla demo

A `jsx6-nodditor` host with **no JSX, no component framework and no signals**: blocks are built with
`document.createElement`, the graph is plain JSON in `localStorage`, and everything else goes through
the editor's documented API.

It exists to answer one question: **what does the editor actually need?** The JSX demo page
(`src/index.jsx`) and the test suites both drag in things — JSX block components, `@jsx6/signal`
state for the menu, `EditableTitle` — that the editor itself does not use. Anything this demo cannot
do without is part of the contract; anything only the other two need is not.

```bash
cd apps/nodditor
bun run build:vanilla          # or: node src_build/vanillaBuild.js
# open build_vanilla/index.html (a static server, or the dev server below)
bun run start:vanilla          # bundles once; serve build_vanilla/ however you like
```

The measured surface lives in [smoke/essential.smoke.js](../../smoke/essential.smoke.js)
(`node smoke/essential.run.mjs`), which runs this demo under happy-dom with a recording backend and
prints every primitive a real session touches.

## What a host must provide

| Requirement | Why |
| --- | --- |
| `<jsx6-nodditor>` with a definite box | the editor pans/zooms inside it; `contain: strict` is enough |
| `menuGenerator` (a function) | called on every selection change; return an element, or nothing for no menu |
| `typeMap` — one **fresh** element per call | `loadGraph` and therefore undo/redo rebuild blocks through it |
| connectors: elements with `ncid` and `ne-connect="in\|out"` | connector discovery walks the block subtree for `ncid` |
| `ne-drag` on the part that moves the block, `ne-nodrag` on parts that must not | pointer handling |
| `ne-item` on rows, if you want the menu aligned to selection rows | `moveMenu` |
| a class on your blocks' connectors carrying `--offset-x` / `--offset-y` | the line endpoints are placed from those custom properties |
| `class="NodeEditor"` on the host element | the shipped CSS scopes `[selected]` styling to `.NodeEditor` |

The editor owns the canvas, the SVG line layer, connector discovery, selection, drag-connect, the
marquee, keyboard handling, zoom/pan, undo/redo and the `ne-*` events. A block is *any* element: no
base class, no lifecycle hook, and no jsx6 state is involved (`block.setNodeEditor?.(editor)` is the
only optional hook the editor calls).

## Host contract sharp edges

These are real behaviours found by writing this demo. They are not bugs in the editor, but a host
that does not know them will look broken:

1. **`menuGenerator`, not `menu`.** The editor stores the generator under `menuGenerator` (the `menu`
   *tpl option* is where it lands). Setting `editor.menu = …` is silently ignored.
2. **A line selection is sticky.** `deleteSelection()` acts on the selected *line* when one is
   selected, and `selectBlocks()` does not clear `selectedLine`. A host with a single "delete" action
   must call `selectConnector(null)` first — and to delete a line, select it and leave the blocks
   alone.
3. **`BlockData` objects go stale.** `undo()`/`redo()`/`loadGraph()` rebuild the whole graph, so
   every `BlockData` object is replaced while the ids stay the same. Re-read with
   `editor.getBlockData(id)`; a stale object passed to `removeBlock()` is a **silent** no-op
   (`blocks.indexOf(block) === -1`).
4. **`ne-move` is batched**, one event per frame of movement carrying `detail.connectors`. Persist on
   `ne-move-done` (as this demo does), not on every `ne-move`.

## Files

- [index.html](index.html) — the entire host markup (toolbar + the editor element)
- [index.css](index.css) — host chrome only; block/line/menu styling comes from the package's own
  `NodeEditor.css` and `ne-blocks.css`, which the build copies next to it
- [demo.js](demo.js) — the graph model (`makeBlock`, `typeMap`, `defaultGraph`) and `startVanillaDemo`
- [boot.js](boot.js) — the demo page entry (`bootVanillaDemo()`)
