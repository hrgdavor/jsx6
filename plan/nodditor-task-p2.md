# Task P2 — UX improvements

**Start here (fresh agent):**

1. Read [nodditor-common.md](./nodditor-common.md) — how to run, layout map, DOM contract, handoff rules.
2. Previous task: P1. Read [nodditor-task-p1-summary.md](./nodditor-task-p1-summary.md) — **it
   overrides the line numbers below** where it reports shifts or renames.
3. Line numbers below describe the **pre-P2 tree** (post-P1 if the P1 summary is present).

**Goal:** make the editor usable for real graphs: multi-select, keyboard, undo/redo, zoom-in,
snapping, context menu, accessibility. Depends on P0 (selection/deselect semantics) and P1
(persistence for undo).

## Read first (task context)

1. [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx): `selectBlocks` (L527–L567),
   `selectConnector` (L569–L576), `deselect` (L578–L581), pointer handlers (L330–L417),
   `keypress` (L418–L427), `changeZoom` / clamps (L458–L479), `fireMoveDone` (L594–L603),
   `setPos` (L233–L245).
2. [index.jsx](../apps/nodditor/src/index.jsx) L40–L49 (`menuGenerator` + the X/E menu) and
   [NodeEditor.css](../apps/nodditor/static/NodeEditor.css) L42–L59 (`.ne-menu` styles).
3. [notes.md](../apps/nodditor/notes.md) — the three zoom entry points (`changeZoomMouse`,
   `changeZoomCenter`, `changeZoom`).
4. [EditableTitle.js](../apps/nodditor/src/EditableTitle.js) — the existing in-place edit pattern.

## Changes

1. **Multi-select.** Shift/Ctrl-click to toggle a block in `selectedBlocks`; add a marquee rectangle
   select on empty-canvas drag (pointer handlers at [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx)
   L333–L417; selection rendering at L553–L566).
2. **Keyboard.** Arrow-key nudge for selected blocks (Shift = coarser step) reusing `setPos`
   ([NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) L233–L245); Ctrl+A select all; Esc deselect
   (extend `keypress` at L418–L427).
3. **Undo/redo.** Snapshot `{blocks, lines}` on mutating events (`ne-move-done` via `fireMoveDone`
   L594–L603, `add` / `removeBlock` / `addConnector`); Ctrl+Z / Ctrl+Shift+Z. Reuse P1's
   full-graph save/load serialization — see the P1 summary for the API.
4. **Zoom beyond 100%.** The clamp `if (newZoom > 1) newZoom = 1` at
   [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) L468 — make min/max configurable (default
   0.3–4) and add a small zoom indicator/controls using the existing `changeZoom*` API
   ([notes.md](../apps/nodditor/notes.md)).
5. **Snapping.** Optional grid-snap in the block-move rAF branch
   ([NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) L401–L411).
6. **Context menu.** Right-click (`contextmenu`) on a block/line opens the `menuGenerator` menu
   (pattern at [index.jsx](../apps/nodditor/src/index.jsx) L40–L49, insertion at
   [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) L544) instead of only on selection; wire the
   "E" edit button (removed in P0, [index.jsx](../apps/nodditor/src/index.jsx) L45–L47 in the pre-P0
   tree) to `EditableTitle`.
7. **Accessibility.** ARIA roles/labels for blocks (set in `add`, L108–L136), lines
   ([ConnectLine.js](../apps/nodditor/src/ConnectLine.js) L15 `el`), and an `aria-live` region for
   selection state; keep the existing focus outline rules
   ([NodeEditor.css](../apps/nodditor/static/NodeEditor.css) L8–L10).

## Verify

- Shift-click two blocks → both selected, the menu follows the group; marquee selects a region.
- Arrow keys move a selection; Ctrl+Z restores position and line routing.
- Wheel zoom can exceed 100%; the indicator reflects zoom.
- Right-click a block → menu; keyboard-only pass: focus the editor, Delete, arrows all work.
- Demo still correct after all changes (`bun start` → `http://127.0.0.1:5111`).

## When done — handoff to P3

Write [nodditor-task-p2-summary.md](./nodditor-task-p2-summary.md) per the handoff pattern in
[nodditor-common.md](./nodditor-common.md). The next task is
[nodditor-task-p3.md](./nodditor-task-p3.md) — your summary must cover everything it references:

- [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx): ResizeObserver handler (L253–L305,
  per-block re-check L294–L304), `recheckConnectors` (L138–L141), `_setPos` (L238–L245, fires
  `ne-move` per connector), `fireCustom` (L589–L592), `moveAll` (L226–L231), `selectBlocks`
  (L527–L567, `blocks.includes(p)` per block), `blockIdMap` (L531–L535), `fireMoveDone` `setTimeout`
  (L599–L601).
- [connectorUtil.js](../apps/nodditor/src/connectorUtil.js): `findConnector` (L11–L60),
  `recalcPos` (L79–L82).
- [moveMenu.js](../apps/nodditor/src/moveMenu.js) L1–L11.
- [LineInteraction.js](../apps/nodditor/src/LineInteraction.js) L85 (`document.elementFromPoint`).
- Any new selection/zoom APIs P3 must keep compatible with (multi-select state shape, zoom min/max
  config).
