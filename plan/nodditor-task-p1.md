# Task P1 — Robustness and API hardening

**Start here (fresh agent):**

1. Read [nodditor-common.md](./nodditor-common.md) — how to run, layout map, DOM contract, handoff rules.
2. Previous task: P0. Read [nodditor-task-p0-summary.md](./nodditor-task-p0-summary.md) — **it
   overrides the line numbers below** where it reports shifts or renames.
3. Line numbers below describe the **pre-P1 tree** (i.e. post-P0 if the P0 summary is present).

**Goal:** make the public API safe and the component leak-free. Edge behavior may change (duplicate
ids, duplicate lines) but the demo must keep working.

## Read first (task context)

1. [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx): `add` (L108–L136), `removeLine` /
   `removeBlock` (L189–L208), `addConnectorFromTo` (L500–L505), `lineHasConnector` (L181–L187),
   ResizeObserver setup (L306–L307), `lineinteraciton` (L98, L352).
2. [connectorUtil.js](../apps/nodditor/src/connectorUtil.js) `findConnector` (L11–L60) and
   [updateObserver.js](../apps/nodditor/src/updateObserver.js) `updateObserver` (L7–L21).
3. [index.jsx](../apps/nodditor/src/index.jsx) L26–L32 (`moveDone` → `localStorage 'ne.positions'`),
   L73–L100 (restore + hardcoded connections).
4. [package.json](../apps/nodditor/package.json) L59–L65 (dependencies — `@jsx6/dom-observer` is
   declared but unused in `src`).
5. [EditableTitle.js](../apps/nodditor/src/EditableTitle.js) L14–L27 (contenteditable lifecycle) and
   [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) L418–L427 (Delete-key handler).

## Changes (exact sources)

1. **Duplicate block ids.** [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) `add` L108–L136:
   `this.blockMap.set(id, blockData)` (L131) silently overwrites while `this.blocks.push` (L130)
   duplicates. Throw when `this.blockMap.has(id)`.
2. **Duplicate / self lines.** [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx)
   `addConnectorFromTo` L500–L505: reject `c1 === c2` (self-connect) and reject a pair that already
   exists. `lineHasConnector` (L181–L187) is the existing pattern but only blocks single-connector
   reuse and is only used during drag ([LineInteraction.js](../apps/nodditor/src/LineInteraction.js)
   L56); add a pair-level check over `this.lines` comparing `p1.con.idFull` / `p2.con.idFull`.
3. **Connector lifecycle on DOM changes.** [connectorUtil.js](../apps/nodditor/src/connectorUtil.js)
   `findConnector` (L11–L60) only *adds* connectors; if an `ncid` element is removed from a block,
   the stale `ConnectorData` stays in `connectorMap` / `resizeSet` and lines keep pointing at dead
   elements. Watch for removed connector elements — the already-declared `@jsx6/dom-observer`
   dependency is the intended tool — and clean up: remove from `connectorMap` / `resizeSet`,
   `finalize` the element ([listenUntil.js](../apps/nodditor/src/listenUntil.js) L20–L23), and remove
   connected lines using the filter pattern from [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx)
   L203–L204. **This change is what P3's memoization builds on — note in your summary how the
   "structurally changed" signal is exposed.**
4. **Teardown / leak.** [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) L306–L307: the
   `ResizeObserver` is never disconnected when the element leaves the DOM. Add a `destroy()` (or the
   custom-element disconnected callback — see `@jsx6/w` `JsxW`, used at L75) that disconnects the
   observer and finalizes lines/blocks.
5. **Public property typo alias.** `lineinteraciton` at [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx)
   L98 and L352. Keep the property for compatibility; add a correctly spelled `lineinteraction`
   alias. Note in a changelog entry that a breaking rename is planned for v2.
6. **Full-graph persistence.** [index.jsx](../apps/nodditor/src/index.jsx) L26–L32 persists
   **positions only** (`localStorage 'ne.positions'`); block types and connections are hardcoded
   again at L87–L99. Add save/load on `NodeEditor`: serialize
   `{ blocks: [{id, type, pos}], lines: [[idFull, idFull]] }` (ids via `ConnectorData.idFull`,
   [connectorUtil.js](../apps/nodditor/src/connectorUtil.js) L35) and use it in the demo instead of
   the hardcoded graph. **P2's undo/redo will reuse this — note the exact API in your summary.**
7. **Delete key vs editable title.** [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) L418–L427:
   Delete/Backspace deletes selected blocks whenever the editor has focus — including while
   [EditableTitle.js](../apps/nodditor/src/EditableTitle.js) L14–L19 has left its element
   `contenteditable`. Guard with `document.activeElement` (skip when it is contenteditable). In
   `EditableTitle`: focus the title element when editing, commit on Enter, cancel (restore `old`) on
   Escape, and remove the `contenteditable` attribute on both paths (today only `onblur`, L20–L26,
   which never fires because focus goes to the editor host).
8. **Global leak.** [index.jsx](../apps/nodditor/src/index.jsx) L56:
   `const editor = (window.editor = …)` — drop the `window.editor` assignment.

## Verify

- Demo still loads and works (`bun start` → `http://127.0.0.1:5111`).
- `editor.add(<Switch/>, '1')` twice → throws; `addConnectorFromTo('1/o1', '1/o1')` and a repeated
  `addConnectorFromTo('1/o1', '2/i1')` are rejected.
- Removing a block with `editor.removeBlock(...)` (and/or after its content changes) → no orphan lines.
- Delete a connected block while a line is selected → `selectedLine` is cleared.
- Delete key while editing a block title → nothing is deleted.
- Reload the demo → the saved graph (including connections) is restored.

## When done — handoff to P2

Write [nodditor-task-p1-summary.md](./nodditor-task-p1-summary.md) per the handoff pattern in
[nodditor-common.md](./nodditor-common.md). The next task is
[nodditor-task-p2.md](./nodditor-task-p2.md) — your summary must cover everything it references:

- [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx): `selectBlocks` (L527–L567), `selectConnector`
  (L569–L576), `deselect` (L578–L581), pointer handlers (L330–L417), `keypress` (L418–L427),
  `changeZoom` / clamps (L458–L479), `fireMoveDone` (L594–L603), `setPos` (L233–L245).
- [index.jsx](../apps/nodditor/src/index.jsx): `menuGenerator` + X/E menu (L40–L49).
- [NodeEditor.css](../apps/nodditor/static/NodeEditor.css): `.ne-menu` styles (L42–L59).
- New APIs P2 will build on: full-graph save/load (P1-6), `destroy()` (P1-4), `lineinteraction`
  alias (P1-5).
- [EditableTitle.js](../apps/nodditor/src/EditableTitle.js) post-change state (P2-6 wires the "E"
  button to it).
