# Task P3 — Performance

**Start here (fresh agent):**

1. Read [nodditor-common.md](./nodditor-common.md) — how to run, layout map, DOM contract, handoff rules.
2. Previous task: P2. Read [nodditor-task-p2-summary.md](./nodditor-task-p2-summary.md) — **it
   overrides the line numbers below** where it reports shifts or renames.
3. Line numbers below describe the **pre-P3 tree** (post-P2 if the P2 summary is present).
4. **Dependency check:** P3-1 (memoized connector discovery) relies on P1-3's MutationObserver
   connector tracking. If P1 was not run or its summary reports a different design, adapt P3-1 to
   whatever "structurally changed" signal actually exists (see the P1 summary).

**Goal:** make large graphs (hundreds of blocks) smooth.

## Read first (task context)

1. [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx): ResizeObserver handler (L253–L305,
   per-block re-check L294–L304), `recheckConnectors` (L138–L141), `_setPos` (L238–L245, fires
   `ne-move` per connector), `fireCustom` (L589–L592, fires on the element **and** the editor),
   `moveAll` (L226–L231), `selectBlocks` (L527–L567, `blocks.includes(p)` per block),
   `fireMoveDone` `setTimeout` (L599–L601).
2. [connectorUtil.js](../apps/nodditor/src/connectorUtil.js): `findConnector` (L11–L60 — full
   subtree scan + `getComputedStyle` per connector), `recalcPos` (L79–L82), `calcPos`
   ([calcPos.js](../apps/nodditor/src/calcPos.js) L1–L9).
3. [moveMenu.js](../apps/nodditor/src/moveMenu.js) L1–L11 (`getBoundingClientRect` per call; called
   every drag frame from [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) L405–L411 and L546).
4. [LineInteraction.js](../apps/nodditor/src/LineInteraction.js) L85 (`document.elementFromPoint` per
   pointermove).

## Changes

1. **Memoize connector discovery.** `findConnector` only rescans a block subtree when its DOM has
   structurally changed (use P1-3's MutationObserver signal); otherwise reuse `connectorMap`.
2. **Batch `ne-move`.** `_setPos` / `moveAll` currently emit a custom event per connector per
   animation frame. Coalesce to one event per rAF (array of changed connectors in `detail`) or
   debounce; keep the existing event names (`ne-move`, `ne-move-done`) and the detail shape for
   backward compatibility — [index.jsx](../apps/nodditor/src/index.jsx) L17–L32 is the reference
   consumer.
3. **O(1) selection.** Replace `blocks.includes(p)` in [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx)
   L556 with a Set of ids (a `blockIdMap` already exists at L531–L535).
4. **Menu repositioning.** Cache the menu rect (re-measure only when its content changes) and drop
   the `setTimeout` in `fireMoveDone` (L599–L601) in favor of positioning inside the same rAF as the
   move.
5. Optional: rAF-throttle `document.elementFromPoint` in
   [LineInteraction.js](../apps/nodditor/src/LineInteraction.js) L85 if drag feels heavy.

## Verify

- Demo still smooth on `http://127.0.0.1:5111`.
- Stress: add ~200 blocks via a console snippet using `editor.add`
  ([index.jsx](../apps/nodditor/src/index.jsx) L87–L94 pattern) and drag the canvas — no jank from
  the resize scan (confirm with DevTools / `performance`).
- `ne-move` consumers still receive correct positions (log in `onMove`, [index.jsx](../apps/nodditor/src/index.jsx)
  L17–L24).
- Existing P2 features (multi-select, undo, zoom) unaffected.

## When done — handoff to P4

Write [nodditor-task-p3-summary.md](./nodditor-task-p3-summary.md) per the handoff pattern in
[nodditor-common.md](./nodditor-common.md). The next task is
[nodditor-task-p4.md](./nodditor-task-p4.md) — your summary must cover everything it references:

- [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx): stale `// todo remove lines connected to it`
  comment (L202 in the pre-P0 tree), plus any line shifts from your changes.
- [index.jsx](../apps/nodditor/src/index.jsx): `points` (L12), `onMove` (L17–L24), `menu.afterAdd`
  (L51–L53), commented code (L100–L102).
- [package.json](../apps/nodditor/package.json) L64: state clearly **whether `@jsx6/dom-observer` is
  now used** (P1-3) — P4 decides keep vs remove.
- [connectorUtil.js](../apps/nodditor/src/connectorUtil.js), [LineInteraction.js](../apps/nodditor/src/LineInteraction.js),
  [moveMenu.js](../apps/nodditor/src/moveMenu.js) post-change state (P4 removes dead code nearby).
