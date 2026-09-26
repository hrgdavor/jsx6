# Task P2 summary — nodditor UX improvements

**Status:** done. All 7 changes (P2-1…P2-7) applied; 68 new smoke assertions pass, P1's 45 still pass.

## Changes (file → what changed → lines AFTER; this table is the new line-number authority)

| File | Change | Lines after |
|---|---|---|
| src/NodeEditor.jsx (**1250** lines, was 761) | `tpl` config params: `{ menu, zoomMin=0.3, zoomMax=4, snap=0, nudgeStep=10, typeMap }` — assigned as editor props (undo needs `typeMap`) | L307–L324 |
| src/NodeEditor.jsx | ResizeObserver handler (P3-1 target) | **L326–L379** (per-block re-check L368–L378) |
| src/NodeEditor.jsx | `recheckConnectors` (unchanged) / `_setPos` fires `ne-move` per connector (P3-2 target) | L158–L161 / L289–L296 |
| src/NodeEditor.jsx | zoom UI (`ne-zoom-ui` −/%/+ buttons) + `statusEl` (`aria-live`) inserted into the host (unscaled); `updateZoomUI` called from zoom setter | L392–L408, setter L717–L724 |
| src/NodeEditor.jsx | pointer handlers rewritten (P3-4 rAF branch): group-drag (`dragList`/`dragStart` snapshot, snap of primary, `_setPos` per member, `moveMenu(dragList,...)`), **marquee on empty-canvas left-drag** (pan = middle/Alt+left; right-button ignored), `contextmenu` listener | pointerdown L443, pointerup L479, pointermove L529 (rAF branch L563–L583), contextmenu L594–L628 |
| src/NodeEditor.jsx | `keypress` extended: Ctrl+Z/Y undo/redo, Ctrl+A, Ctrl ±/0 zoom, Esc, Enter/Space selects focused block/line, arrows nudge (Shift ×5); `focusin`/`focusout` keep `$s.hasFocus` true for descendants | L629–L706 |
| src/NodeEditor.jsx | changeZoom: `clampZoom` replaces the 100% cap (dust-snaps to bounds); `zoomTo`, `updateZoomUI`; recenter now triggers on x OR y; `fireMoveDone(null,'zoom')` | L739–L789 |
| src/NodeEditor.jsx | undo/redo on P1 serialization: `historyRecord(kind)` (diff-checked snapshot; only `zoom`/`nudge` kinds merge <750ms; `_batchDepth` batches `deleteBlocks`; suppressed during `loadGraph`/`destroy`), `historyReset`, `undo`, `redo`; called from `add`, `removeLine`, `removeBlock`, `addConnectorFromTo`, `fireMoveDone` | L923–L988 (calls: add L154, removeLine L216, removeBlock L257, addConnectorFromTo L847, fireMoveDone L1234) |
| src/NodeEditor.jsx | `saveGraph` COPIES pos arrays (snapshots vs live data); `loadGraph(state, typeMap = this.typeMap)` + resets history baseline | L875–L881 / L895–L921 |
| src/NodeEditor.jsx | selection APIs (P3-3 O(1)-target still there: `selectBlocks` `blocks.includes(p)` **L1024**, `blockIdMap` L999–L1003): `toggleBlockSelection` L1058, `selectAll` L1067, `deleteSelection` L1072, `blocksInRect` L1089 (intersect = selected), `contentPoint` L1106, `nudgeSelection` L1117 (snap-aware), `placeMenuAtCursor` L1138, `setBlockLabel` L1152, `setAriaStatus` L1161 | — |
| src/NodeEditor.jsx | `add` sets `role=group tabindex=0 aria-label` per block; `selectBlocks`/`selectConnector` update labels + live status; `fireMoveDone(blockData, kind='move')` — still fires `ne-move-done` then menu restore + `setTimeout` **L1238** (P3-4 target, now also carries `historyRecord`); `destroy()` clears stacks | L122–L155, L1232–L1242 |
| src/LineInteraction.js (148) | `pointerup` calls `editor.historyRecord('connect')` (failed drags diff to no-op); `document.elementFromPoint` (P3-5) moved **L85 → L107** | L125–L142 |
| src/ConnectLine.js (149) | line `el` gets `role=img tabindex=0` + `updateAria()` (endpoint ids in `aria-label`, called from `setPoint`); existing `svg g:focus` outline now reachable by Tab | L13–L29, L58–L62, L135–L140 |
| src/moveMenu.js (17) | positions via `getBlocksBounds` → menu centered over the WHOLE selection (single block unchanged); `menu.moveMenu` override hook kept | whole file |
| src/index.jsx (159) | demo menu now: X (`deleteSelection`), E (dispatches `pointerup` on first selected block's `.EditableTitle`), ↶↷ undo/redo, ▦ snap toggle (20px); `typeMap` defined before editor and passed as `typeMap={typeMap}` (L45/L100); unused `forEachProp` import dropped | editTitle L58, menu L70–L88 |
| src/blocks/Switch.js | title replaced by `EditableTitle` (value "Block 1") so E works on all blocks | L8–L11, L19 |
| static/NodeEditor.css (121) | added `.ne-block:focus-visible`, `.ne-marquee`, `.ne-zoom-ui(+.at-min/.at-max)`, `.ne-sr-status`; existing `svg g:focus` rules untouched | L62–L121 |
| static/ne-blocks.css | `.EditableTitle { user-select: text }` (titles live inside `[ne-drag]`'s `user-select: none`) | L27–L33 |
| CHANGELOG.md / dist / smoke | Unreleased P2 entry; `bun run tsc` regenerated; smoke/p2.test.jsx + p2.run.mjs (68 assertions) | — |

## Verification

- `node smoke/p2.run.mjs` → **ALL SMOKE ASSERTIONS PASSED** (click/ctrl/shift toggle, marquee incl. additive, group menu 75px, Esc/Ctrl+A/arrows+Shift, nudge undo merging, structural add/delete/line undo+redo with fresh els from typeMap, undo refused without typeMap, zoom 400%/clamps/tpl min-max/buttons/Ctrl keys, snap on/off, right-click block+line+empty with cursor positioning, roles/labels/live region, keyboard-only Enter→arrows→Delete→undo, ET edit flow).
- `node smoke/p1.run.mjs` → still ALL PASS. `bun run tsc` exit 0; `bun build` BUILD SUCCESS; `bun run format:check apps/nodditor` clean (oxfmt also re-wrapped one pre-existing line in smoke/p1.test.jsx). Dev server: :5111 was held by an orphan live-server from P1 serving the same `build_dev` dir — bundle on :5111 verified to contain all P2 markers (my watcher ran on :58959 during the session).
- No interactive browser: UI verified via smoke tests + served bundle, not manual clicking.

## Impact on P3

- P3 references shift: ResizeObserver handler L326–L379; `recheckConnectors` L158; `_setPos` L289; `fireCustom` L1220; `moveAll` L277; `selectBlocks` L995–L1037 (`blocks.includes` L1024, `blockIdMap` L999); `fireMoveDone` setTimeout L1238; `findConnector`/`recalcPos` unchanged (connectorUtil.js L13/L93); `moveMenu` L7–L16; LineInteraction elementFromPoint L107.
- **Keep compatible:** `selectedBlocks` = array of BlockData, drag-primary FIRST in `dragList` (group drag mutates it); marquee uses intersect; zoom config `editor.zoomMin/zoomMax` + `zoomTo`/`clampZoom` + `updateZoomUI` (setter must keep calling it); `snap` applies to drag AND nudge via primary-offset.
- History cost: `historyRecord` JSON-stringifies `saveGraph()` on every `ne-move-done`/add/remove — O(blocks) per EVENT (never per frame); pan/zoom/nudge paths route through it, so P3-2 batching must not drop `fireMoveDone` calls (undo baseline depends on them). `fireMoveDone(null,...)` is legal (no block event, still records + re-shows menu).
- Blocks/line `g` are now `tabindex=0` (tab order longer; `focusin/focusout` drive `hasFocus`); right-button pointerdown is ignored (contextmenu handles selection).
- Open items deferred: undo doesn't snapshot zoom level itself; first recorded change has no undo step (baseline = post-load state); EditableTitle text isn't part of `saveGraph` (title edits survive only until an undo rebuild); `resizeSet` stale after `recheckConnectors` (unchanged P1 quirk).
