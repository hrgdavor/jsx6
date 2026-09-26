# Change Log - @jsx6/nodditor

This log was last generated on Thu, 25 Apr 2024 11:46:22 GMT and should not be manually modified.

## Unreleased

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
  lines, `aria-live` selection status).
- Behavior change: dragging with the LEFT button on empty canvas now draws a
  selection marquee; canvas panning moved to MIDDLE button or Alt+left drag.
- Zoom: the hard 100% cap is replaced by configurable `zoomMin`/`zoomMax`
  (defaults 0.3–4) and a zoom indicator/controls UI is built into the editor.
  The `zoom` setter clamps now; optional grid snapping via `snap`.

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

