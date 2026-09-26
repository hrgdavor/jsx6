# Nodditor tasks — common context

Shared context for the five task files: [nodditor-task-p0.md](./nodditor-task-p0.md),
[nodditor-task-p1.md](./nodditor-task-p1.md), [nodditor-task-p2.md](./nodditor-task-p2.md),
[nodditor-task-p3.md](./nodditor-task-p3.md), [nodditor-task-p4.md](./nodditor-task-p4.md).

**Every agent starting a task reads this file first**, then the task file it was told to run,
then the previous task's summary file if it exists (see the handoff section below).

App root: `apps/nodditor` (package `@jsx6/nodditor`).

## How to run and verify

- Install: from the repo root, `bun install --frozen-lockfile` (Bun workspace, Bun ≥ 1.3.14 —
  see [README.dev.md](../README.dev.md)).
- Dev server: `cd apps/nodditor && bun start` → `node src_build/build.js --dev` (port 5111,
  live reload) → open `http://127.0.0.1:5111`.
- Production build: `cd apps/nodditor && bun build` → output in `build/`.
- Declarations: `cd apps/nodditor && bun run tsc` (emits `dist/index.d.ts`,
  `emitDeclarationOnly`) — run after any public API change.
- Formatting: `bun run format` from the repo root (oxfmt is canonical).
- Local gate: `bun run check` at the root. Note it type-checks `libs/` only —
  `apps/nodditor` is **not** linted/type-checked by the gate; verify the app by build + demo + format.

## Layout map (where things live)

| File | What's in it |
|---|---|
| [src/NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) | `NodeEditor` class (custom element `jsx6-nodditor`): blocks, lines, selection, zoom, pointer/keyboard handlers, `fireCustom` / `fireMove` / `fireMoveDone`. |
| [src/ConnectLine.js](../apps/nodditor/src/ConnectLine.js) | `ConnectLine` (SVG line, endpoints `p1`/`p2`, `setPoint`, `updatePath`). |
| [src/LineInteraction.js](../apps/nodditor/src/LineInteraction.js) | Drag-to-connect + selected-endpoint logic (`pointerdown` / `pointermove` / `pointerup`). |
| [src/connectorUtil.js](../apps/nodditor/src/connectorUtil.js) | `findConnector` (DOM scan for `ncid` elements), `ConnectorData`, `updateObserver` glue. |
| [src/calcPos.js](../apps/nodditor/src/calcPos.js), [src/makeLineConnector.js](../apps/nodditor/src/makeLineConnector.js), [src/pairUtils.js](../apps/nodditor/src/pairUtils.js), [src/lineUtils.js](../apps/nodditor/src/lineUtils.js) | Pure helpers: connector position math, bezier path, pair utils. |
| [src/getBlocksBounds.js](../apps/nodditor/src/getBlocksBounds.js), [src/getBlocksMinXY.js](../apps/nodditor/src/getBlocksMinXY.js) | Block bounds helpers (currently colliding export names — fixed in P0). |
| [src/index.jsx](../apps/nodditor/src/index.jsx) | Demo page: menu, wheel zoom, localStorage persistence, hardcoded demo graph. |
| [src/blocks/Switch.js](../apps/nodditor/src/blocks/Switch.js), [src/blocks/Message.js](../apps/nodditor/src/blocks/Message.js) | Demo block components (define the block/connector contract). |
| [src/EditableTitle.js](../apps/nodditor/src/EditableTitle.js) | In-place title editing (contenteditable lifecycle). |
| [src/moveMenu.js](../apps/nodditor/src/moveMenu.js), [src/listenUntil.js](../apps/nodditor/src/listenUntil.js) | Menu positioning; event-finalizer helper. |
| [static/index.html](../apps/nodditor/static/index.html), [static/main.css](../apps/nodditor/static/main.css), [static/ne-blocks.css](../apps/nodditor/static/ne-blocks.css), [static/NodeEditor.css](../apps/nodditor/static/NodeEditor.css) | Demo markup/styles. |
| [index.js](../apps/nodditor/index.js) | Public API: star-exports from `src`. |
| [dist/index.d.ts](../apps/nodditor/dist/index.d.ts) | Generated declarations (do not edit by hand). |
| [src_build/build.js](../apps/nodditor/src_build/build.js) | esbuild script (`--dev` = watch + live-server on :5111). |
| [notes.md](../apps/nodditor/notes.md) | Notes on the three zoom entry points. |

## Block / connector DOM contract

- A **block** is a JSX component inserted via `editor.add(block, id, {pos, type})`; it is wrapped
  in a positioned `div.ne-block` carrying a generated `nid`.
- A **connector** is a DOM element inside a block: `<b ncid="o1" ne-connect="out" />`. `ncid` is the
  connector's name within the block; `ne-connect` is `in` or `out`. The global connector id is
  `{blockId}/{ncid}` (`ConnectorData.idFull`, [connectorUtil.js](../apps/nodditor/src/connectorUtil.js)).
- `ne-drag` attribute = drag-handle area of a block; `ne-nodrag` = area that deselects on click.
- Custom events: `ne-move` (per-connector position updates during drag/resize), `ne-move-done`
  (drag ended), `ne-remove` (line endpoint lost — currently only listened for, never fired; see P0/P1).

## Task order and dependencies

```
P0 (bugs) → P1 (robustness) → P2 (UX) → P3 (performance) → P4 (tests / dead code / docs)
```

- P3's memoization (P3-1) relies on P1-3's MutationObserver connector tracking.
- P2's undo/redo builds on P1-6's full-graph persistence.
- P4's dead-code removal is safest after P0 (line numbers shift).
- Tasks are still independent enough to run in isolation if a handoff summary is missing — the
  task file is self-contained; the summary only improves precision.

## Handoff: previous-step summary files (required)

**Pattern:** after completing task `pN`, the agent **must** write
`plan/nodditor-task-pN-summary.md`
(i.e. [nodditor-task-p0-summary.md](./nodditor-task-p0-summary.md) …
[nodditor-task-p4-summary.md](./nodditor-task-p4-summary.md)).

The next task's file instructs its agent to read this summary. The summary must contain **only
information relevant to the next step**:

1. **Status** — one line: `done` / `partial` / `blocked` (+ one-line reason).
2. **Changes** — a table: `file → what changed → line numbers AFTER the change`, limited to the
   files/symbols the *next* task references.
3. **Verification** — commands actually run + outcome (e.g. `bun start` → `:5111`, what was
   exercised in the browser; `bun run format`; `bun run tsc` if `dist` changed).
4. **Impact on next step** — line-number shifts for the next task's referenced locations;
   renamed/added symbols the next task should reuse; open items deferred to later tasks.

Rules:

- If a summary file reports new line numbers or renamed symbols, **it overrides the line numbers in
  the task file** (task files describe the pre-task tree).
- Keep it short (≤ ~50 lines): a handoff, not a changelog.
- If the previous summary is missing, proceed from the task file alone and say so in your own summary.
- Each task file ends with the exact list of references the *next* task needs your summary to cover.
