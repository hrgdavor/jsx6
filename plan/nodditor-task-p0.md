# Task P0 — Fix confirmed bugs in nodditor

**Start here (fresh agent):**

1. Read [nodditor-common.md](./nodditor-common.md) — how to run, layout map, DOM contract, handoff rules.
2. Previous task: none (P0 is first). If [nodditor-task-p0-summary.md](./nodditor-task-p0-summary.md)
   already exists, this task was started before — read it and continue from there.
3. Line numbers below describe the **pre-P0 tree**. If a handoff summary reports shifted lines,
   the summary wins.

**Goal:** eliminate the confirmed correctness bugs. No API changes, no new features.

## Read first (task context)

1. [apps/nodditor/src/NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) — the core class; pointer
   handlers in `tpl()` (L330–L417), zoom code (L434–L479), `fireMove` / `fireMoveDone` (L594–L610),
   `resetView` (L220–L224), `removeLine` / `removeBlock` (L189–L208).
2. [apps/nodditor/src/LineInteraction.js](../apps/nodditor/src/LineInteraction.js) — drag-to-connect +
   selected-endpoint logic (L41–L117).
3. [apps/nodditor/src/ConnectLine.js](../apps/nodditor/src/ConnectLine.js) — line endpoints and
   `ne-move` / `ne-remove` listeners (L53–L68).
4. [apps/nodditor/src/getBlocksBounds.js](../apps/nodditor/src/getBlocksBounds.js) and
   [apps/nodditor/src/getBlocksMinXY.js](../apps/nodditor/src/getBlocksMinXY.js) — the two colliding exports.
5. [apps/nodditor/src/index.jsx](../apps/nodditor/src/index.jsx) — demo page (consumer of `ne-move`).
6. [apps/nodditor/static/index.html](../apps/nodditor/static/index.html) — demo markup.

## Changes (exact sources)

1. **`fireMove` reports `left` as `top`.**
   [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) L609:
   `this.fireCustom(this, evtName, { top: pos[1], left: pos[1], nid: id, domNode: el, pos })`.
   Change `left: pos[1]` → `left: pos[0]`.
2. **`resetView` ignores `pady`.**
   [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) L220–L224; L222:
   `this.moveAll(-minx + padx, -miny + padx)`. Use `pady` for the y offset.
3. **`getBlocksBounds` negative w/h + export-name collision.**
   - [getBlocksBounds.js](../apps/nodditor/src/getBlocksBounds.js) L33:
     `w: minx - maxx, h: miny - maxy` → `w: maxx - minx, h: maxy - miny`.
   - **Rename the exported function `getBlocksMinXY` → `getBlocksBounds`** in that file (L17).
     Reason: [getBlocksMinXY.js](../apps/nodditor/src/getBlocksMinXY.js) L6 exports the *same name*,
     and [index.js](../apps/nodditor/index.js) L8–L9 does `export *` from both — ESM ambiguous star
     exports silently drop the name, so the bounds function is not currently in the public API.
   - Add an empty-array guard to [getBlocksMinXY.js](../apps/nodditor/src/getBlocksMinXY.js) L7–L14
     (currently returns `[MAX_SAFE_INTEGER, MAX_SAFE_INTEGER]` for `[]`; match the guard in
     `getBlocksBounds` at L18).
   - [index.js](../apps/nodditor/index.js) L9: after the rename the `export *` is unambiguous; you may
     switch to an explicit `export { getBlocksBounds } from './src/getBlocksBounds.js'` for clarity.
   - Regenerate `dist`: `cd apps/nodditor && bun run tsc` so [dist/index.d.ts](../apps/nodditor/dist/index.d.ts)
     L8–L9 stay in sync.
4. **Dragging a selected line's endpoint duplicates the line.**
   [LineInteraction.js](../apps/nodditor/src/LineInteraction.js):
   - `pointerdown` L47–L53: when `selected.p2.con == con` it sets `line = selected; isDown = true`
     but never sets `firstCon`.
   - `pointermove` L70–L84: the `isDown && !isMoving` branch unconditionally runs
     `line = this.editor.addConnector(new ConnectLine())` (L71) — pushing a *new* line into
     `editor.lines` while the original selected line is orphaned.
   - Fix: in `pointerdown`, when grabbing an endpoint of the selected line, set `firstCon = con` and
     remember which endpoint (`p1` or `p2` — today only `p2` is handled; handle `p1` too). In the
     first-movement branch of `pointermove`, **reuse the existing `line`** and re-route via
     `setPoint2` / `setPoint1` instead of creating a new `ConnectLine`.
   - Normalize the first placement: L78 `line.setPos2(x, y)` uses raw client coordinates, while
     subsequent moves use `(x - 1 - lx) / this.editor.zoom` (L99). Make the first placement
     consistent with L99 (subtract the editor rect, divide by zoom).
   - Invariant: `addConnector` appends to `editor.lines`
     ([NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) L509–L516) — after the fix, dragging an
     endpoint must not grow `editor.lines`.
5. **Wrong endpoint cleared on `ne-remove` + `selectedLine` never cleared.**
   - [ConnectLine.js](../apps/nodditor/src/ConnectLine.js) L64–L66: the `ne-remove` listener always
     calls `this.setPoint1(null)`; it must clear the endpoint `p` the listener is attached to.
   - `ne-remove` is **never fired anywhere** (grep the repo: only this listener exists). Either fire
     it from `NodeEditor.removeBlock` ([NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) L198–L208,
     connected-lines filter at L203–L204) or delete the dead listener.
   - `removeLine` (L189–L196) and `removeBlock` (L198–L208) must set `this.selectedLine = null` when
     the removed line was selected (currently a dangling reference; Delete-key then no-ops).
6. **Clicking empty canvas doesn't deselect; clicking a `ne-nodrag` block area does.**
   [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx):
   - `pointerdown` L333–L360: clicking empty space falls through and sets `$s.isDown = true` (L359).
   - `pointerup` L362–L380: L364 `if (!$s.isDown()) { this.deselect(); return }` — with `isDown`
     true, deselection is skipped, so the previous selection sticks.
   - Inconsistency: a click on a `ne-nodrag` area inside a block returns early at L349 with `isDown`
     never set, so `pointerup` *does* deselect.
   - Fix: in `pointerup`, deselect when the pointer was not on a block/line and no movement occurred
     (e.g. `domNode == null && !$s.isMoving()`).
7. **Canvas size not refreshed when the editor element resizes (and misspelled method).**
   [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx):
   - ResizeObserver handler branch `if (e.target == this)` (L261–L264) records `realWidth` /
     `realHeight` but never updates `contentArea` dimensions.
   - `udpateSize()` (L445–L448) is only called from the `zoom` setter (L442).
   - Fix: call it inside that resize branch; rename `udpateSize` → `updateSize` (only reference is L442).
8. **Demo page slips.**
   - [static/index.html](../apps/nodditor/static/index.html) L6–L7: `main.css` is linked **twice** —
     remove one.
   - [src/index.jsx](../apps/nodditor/src/index.jsx) L41: `sty:le="…"` typo → `style` (menu
     padding/border never applied).
   - [src/index.jsx](../apps/nodditor/src/index.jsx) L45–L47: the "E" menu button has no handler —
     remove it (wiring it to title-editing is P2 scope).
   - [src/index.jsx](../apps/nodditor/src/index.jsx) L61–L64: `onwheel` zooms without
     `e.preventDefault()` — add it so the page doesn't scroll while zooming.

## Verify

- `cd apps/nodditor && bun start` → open `http://127.0.0.1:5111`.
- Per item:
  1. Drag block 1 straight down — log `detail.left` in `onMove`
     ([index.jsx](../apps/nodditor/src/index.jsx) L17–L24); `left` must stay constant.
  2. `editor.resetView(10, 40)` shifts x and y by different amounts.
  3. `editor.getBlocksBounds()` returns positive `w` / `h` and the export is reachable from
     `@jsx6/nodditor`.
  4. Select a line, drag its input endpoint to another connector — `editor.lines.length` unchanged,
     the single line re-routed.
  5. Select a line, press Delete — `editor.selectedLine` becomes `null`.
  6. Select a block, click empty canvas — selection clears.
  7. Resize the browser window — `contentArea` width/height px follow.
  8. Menu shows padding/border; wheel zoom doesn't scroll the page.
- `bun run format` from repo root; `cd apps/nodditor && bun build` succeeds.

## When done — handoff to P1

Write [nodditor-task-p0-summary.md](./nodditor-task-p0-summary.md) per the handoff pattern in
[nodditor-common.md](./nodditor-common.md). The next task is
[nodditor-task-p1.md](./nodditor-task-p1.md) — your summary must cover every change and line shift
it references:

- [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx): `add` (L108–L136), `removeLine` /
  `removeBlock` (L189–L208), `lineHasConnector` (L181–L187), `addConnectorFromTo` (L500–L505),
  ResizeObserver setup (L306–L307), `lineinteraciton` (L98, L352), Delete-key handler (L418–L427).
- [index.jsx](../apps/nodditor/src/index.jsx): `moveDone` / localStorage (L26–L32), restore +
  hardcoded connections (L73–L100).
- [EditableTitle.js](../apps/nodditor/src/EditableTitle.js) (L14–L27) and
  [package.json](../apps/nodditor/package.json) dependencies (L59–L65).
- Any renamed symbols (e.g. `udpateSize` → `updateSize`, `getBlocksBounds`) and the regenerated
  `dist/index.d.ts` state.
