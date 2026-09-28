# Change Log - @jsx6/nodditor

This log was last generated on Thu, 25 Apr 2024 11:46:22 GMT and should not be manually modified.

## Unreleased

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

