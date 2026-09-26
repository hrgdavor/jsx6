# Task P4 — Tests, dead code, docs

**Start here (fresh agent):**

1. Read [nodditor-common.md](./nodditor-common.md) — how to run, layout map, DOM contract, handoff rules.
2. Previous task: P3. Read [nodditor-task-p3-summary.md](./nodditor-task-p3-summary.md) — **it
   overrides the line numbers below** where it reports shifts or renames.
3. Line numbers below describe the **pre-P4 tree** (post-P3 if the P3 summary is present). Grep to
   confirm every dead-code item **before** deleting — earlier tasks may have touched these spots.

**Goal:** make future changes safe: test coverage for the app, removal of dead code, and a real app
README.

## Read first (task context)

1. Repo test conventions: `bun run test` at the root discovers tests in every package
   ([README.dev.md](../README.dev.md) L28, L64); the only existing app test is
   [apps/repl/src/Loop2.test.js](../apps/repl/src/Loop2.test.js). `happy-dom` /
   `@happy-dom/global-registrator` are already in the root [catalog](../package.json) (L34–L35) —
   available for DOM-level unit tests without a browser.
2. The dead-code list below (verify each with grep first).
3. [apps/nodditor/notes.md](../apps/nodditor/notes.md) (current docs: zoom only) and
   [apps/nodditor/index.js](../apps/nodditor/index.js) (public API surface).

## Changes

1. **Tests** (add `apps/nodditor/test/` or `*.test.js` beside sources, matching repo discovery):
   - Pure functions, no DOM needed: `getBlocksBounds` / `getBlocksMinXY`
     ([getBlocksBounds.js](../apps/nodditor/src/getBlocksBounds.js), [getBlocksMinXY.js](../apps/nodditor/src/getBlocksMinXY.js)),
     `calcPos` shape, `makeLineConnector` path output
     ([makeLineConnector.js](../apps/nodditor/src/makeLineConnector.js) L16–L20), `pairUtils`
     ([pairUtils.js](../apps/nodditor/src/pairUtils.js)).
   - DOM-level with happy-dom: `NodeEditor.add` / `getConnector` / `selectBlocks` data model,
     `addConnectorFromTo` duplicate rejection (P1-2), Delete-key behavior.
2. **Dead-code removal** (verify each with grep first):
   - [index.jsx](../apps/nodditor/src/index.jsx): `points` (L12, never read) and `onMove` (L17–L24,
     only writes to `points`; wired at L65) → remove all three; `menu.afterAdd` no-op (L51–L53) →
     remove; commented-out code (L100–L102) → remove.
   - [Message.js](../apps/nodditor/src/blocks/Message.js) L7 `console.log` handlers → remove.
   - [NodeEditor.jsx](../apps/nodditor/src/NodeEditor.jsx) L202 (pre-P0 numbering) stale
     `// todo remove lines connected to it` (implemented just below) → remove.
   - [build.js](../apps/nodditor/src_build/build.js) L24 comment references `ChatBox.js` (copy-paste
     artifact) → fix/remove.
   - [NodeEditor.css](../apps/nodditor/static/NodeEditor.css) L29–L40 `.ne-focus-bt` rules — class
     used nowhere in `src` → remove.
   - [main.css](../apps/nodditor/static/main.css) L172 `.h50 { width: 50% }` should be `height` —
     shared file, fix carefully (other apps include it).
   - [ne-blocks.css](../apps/nodditor/static/ne-blocks.css) L58 and L62: `display` declared twice
     (`inline-block` then `flex`) → keep one.
   - [package.json](../apps/nodditor/package.json) L64 `@jsx6/dom-observer`: **keep if P1-3 uses it
     (check the P3 summary — it states this explicitly), remove otherwise.**
   - `dist/` is generated — regenerate after any API change (`cd apps/nodditor && bun run tsc`).
3. **Docs.** Write [apps/nodditor/README.md](../apps/nodditor/README.md) (currently absent;
   `notes.md` only covers zoom): what it is, how to run the demo (`bun start` → :5111), the public
   API (`add`, `getConnector`, `addConnectorFromTo`, `selectBlocks`, `changeZoom*`, `resetView`), the
   block/connector DOM contract (`nid`, `ncid`, `ne-connect="in|out"`, `ne-drag`, `ne-nodrag` — see
   [Switch.js](../apps/nodditor/src/blocks/Switch.js) L12/L19 and [connectorUtil.js](../apps/nodditor/src/connectorUtil.js)
   L23–L51), and how to register custom blocks.
4. **Format gate.** Run `bun run format` from the repo root after all deletions (oxfmt is canonical;
   `bun run check` at the root is the full local gate, though it only type-checks `libs/` — verify
   the app with `bun build` + the demo).

## Verify

- `bun run test` at the root discovers and passes the new nodditor tests.
- Demo still identical on `http://127.0.0.1:5111` after dead-code removal (positions, lines, menu
  behavior).
- `npm pack --dry-run` (or the manifest-audit step of `bun run check`) still passes for
  `@jsx6/nodditor` (files: `index.js`, `dist`, `src`).

## When done — handoff to P5 (if one exists)

Write [nodditor-task-p4-summary.md](./nodditor-task-p4-summary.md) per the handoff pattern in
[nodditor-common.md](./nodditor-common.md). P4 is the last task in the current series; if a P5 task is
added later, its "read first" list should be mirrored in this summary.
