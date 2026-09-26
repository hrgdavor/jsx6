# Task P4 summary — nodditor tests, dead code, docs

**Status:** done. 38 new `bun test` assertions pass and the FULL `bun run check` gate passes (was
failing before P4 — see below); dead code from the P4 list + the P3 leftovers removed; README written.

## Changes (file → what changed → lines AFTER; this table is the new line-number authority)

| File | Change | Lines after |
|---|---|---|
| test/setup.js (27) | **new** — happy-dom globals + `IntersectionObserver` stub; imported FIRST by DOM tests | — |
| test/pure.test.js (146) | **new** — `getBlocksBounds`, `getBlocksMinXY`, `calcPos` (fake offset chain), `makeLineConnector`, `pairUtils` | — |
| test/editor.test.jsx (295) | **new** — `add`, `getConnector` (3 id forms), `addConnectorFromTo` + P1-2 duplicates, `selectBlocks`, Delete/Backspace | — |
| bunfig.toml (11) | **new** — `jsxImportSource = "@jsx6"` (without it `bun test` resolves JSX to react) | — |
| package.json (67) | devDependency `@happy-dom/global-registrator: catalog:` (L57) | L56–58 |
| README.md (264) | **new** — run/API/DOM contract/custom blocks/events/tests | — |
| smoke/pN.test.jsx → **smoke/pN.smoke.jsx** | renamed (same content) so `bun test` cannot discover them; `smoke/pN.run.mjs` entry point updated (+ header note) | runners L1–12, `entryPoints` L32/L30/L37 |
| src/index.jsx (140, was 171) | `points`, `onMove`, `onne-move` wiring, `menu.afterAdd`, dead `ConnectLine`/`EditableTitle` imports, 3 comment blocks removed; `moveDone()` takes no arg | `saveGraph` L18, `moveDone` L22, `typeMap` L32, editor L78, `onne-move-done` L89, `onne-remove` L90 |
| src/NodeEditor.jsx (1500, was 1507) | `Menu`/`MenuHtml` typedef, `menu.afterAdd?.()` (both call sites) removed | `selectBlocks` L1220, generator L1231, context menu L842/L852, `placeMenuAtCursor` L1365 |
| src/blocks/Message.js (24) | `console.log` handlers dropped → `EditableTitle()` | L7 |
| src_build/build.js (33) | stale `ChatBox.js` comment → real dev/prod comment | L24–25 |
| src/… + static/… | `NodeEditor.css` 121→**108** (`.ne-focus-bt` gone), `main.css` **L171** `height: 50%`, `ne-blocks.css` 100→**99** (single `display: flex`) | — |
| dist/ (gitignored) | regenerated with `bun run tsc`; no `afterAdd`/`MenuHtml` in `NodeEditor.d.ts` | — |
| .oxfmtrc.json | `ignorePatterns` += `"smoke/*.bundle.mjs"` (esbuild output, rewritten by every smoke run) | L49 |
| smoke/p1,p2,p3.bundle.mjs | regenerated; p1/p2 now carry the (uncommitted) P3 delta | — |
| CHANGELOG.md | Unreleased: P4 maintenance entry + the `ne-move` consumer note | L38–42 |

**`@jsx6/dom-observer` stays** (P3 summary confirmed: `connectorUtil.js` L3/L71).

## Verification (commands actually run)

- `bun test` (apps/nodditor) → **38 pass / 0 fail**; `bun run test` at the root → all packages PASS.
- `bun run check` (root) → **all 9 steps PASS** (tests, tsc, type check, oxlint, oxfmt, versions, docs,
  manifest audit, workspace integrity), `total 22.1s`.
- `bun run tsc` (exit 0), `bun run build` → `BUILD SUCCESS`, `node smoke/p1|p2|p3.run.mjs` → all
  `ALL SMOKE ASSERTIONS PASSED`.
- `npm pack --dry-run` → `index.js`, `README.md`, `src/**`, `dist/**`; **no test files**.
- Demo: `bun start` is running again on <http://127.0.0.1:5111> (the P3 orphan is gone) — `GET /` 200,
  served `main.css` has `height: 50%`, `NodeEditor.css` has no `.ne-focus-bt`, `index.js` (47967 B) has
  `flushMoves`/`movedStamp` and no `afterAdd`. Additionally the real `build_dev/index.js` was booted
  under happy-dom: 4 blocks, 2 lines, connector `1/o1`, menu on selection, move→`localStorage`, delete,
  undo all OK (temp script, deleted).

## Impact on the next step (P4 is the last task — no P5 references yet)

- **Two pre-existing gate breakages fixed:**
  1. `bun test` in this package tried to run `smoke/*.test.jsx` (script-style suites that need their
     own runner and DOM globals), and with no `bunfig.toml` its JSX resolved to
     `react/jsx-dev-runtime`. Fix: `bunfig.toml` with `jsxImportSource = "@jsx6"`, and the suites
     renamed to `smoke/pN.smoke.jsx` (they are not `bun test` files — run them with
     `node smoke/pN.run.mjs`). The rename is also what makes `bun test apps/nodditor`-style
     invocations safe: Bun reads `bunfig.toml` from the cwd, so from the repo root the app's config
     does not apply.
  2. Every `node smoke/pN.run.mjs` run rewrites `smoke/pN.bundle.mjs` (esbuild output), which is not
     Oxfmt-canonical — so the gate's oxfmt step failed again after any smoke run. The generated
     bundles are now excluded via `ignorePatterns: ["smoke/*.bundle.mjs"]` in
     `apps/nodditor/.oxfmtrc.json` (a nested config replaces the root one, so it must list its own).
- New test conventions to reuse: DOM-level tests are `test/*.test.jsx` starting with
  `import './setup.js'`; pure tests are `test/*.test.js` (no DOM, no setup import needed).
  happy-dom quirks already encoded: `setSelected` sets `selected="selected"`, `setVisible` sets
  `hidden`, and `isContentEditable` must be emulated (`Object.defineProperty`).
- Deferred dead code (P3's list, **left alone on purpose** to keep P4 scoped): `lx`/`ly` in
  `LineInteraction.js` L32–33 (written L103–104, never read), unused `contentRect` in the RO handler
  (`NodeEditor.jsx` L483), `updateObserver()`'s unused `removed`, `ConnectLine.js` L132/L136
  `// todo box pos`, and the `console.log` in `blocks/Switch.js` L13.
- `smoke/*.bundle.mjs` changes in git are not P4's: P3 never committed them, so regenerating them
  bundled the accumulated P3+P4 source into p1/p2 (p3 was already current).
