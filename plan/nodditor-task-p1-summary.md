# Task P1 summary — nodditor robustness & API hardening

**Status:** done. All 8 changes (P1-1…P1-8) applied; 45 headless smoke assertions pass.

## Changes (file → what changed → lines AFTER; this table is the new line-number authority)

| File | Change | Lines after |
|---|---|---|
| src/NodeEditor.jsx (**761** lines, was 619) | `lineinteraction` get/set alias of `lineinteraciton` (P1-5) | L101–L113 |
| src/NodeEditor.jsx | `add` throws `block id "…" is already in use` (P1-1) | guard L123 (method L122–L151) |
| src/NodeEditor.jsx | new `removeConnector(con)` (P1-3): idempotent; drops from `connectorMap`/`resizeSet`; **filters lines before firing `ne-remove`** (listener nulls endpoints, filtering after would match nothing); removes those lines; `con.el.removeObserve?.()`; `finalize(con)` (recurses to `con.el`, releasing click+pointer finalizers) | L214–L238 |
| src/NodeEditor.jsx | `removeBlock` → delegates per-connector cleanup to `removeConnector`; **now also deletes `blockMap`/`nodeMap` entries** (smoke test caught that ids could never be re-added — this also fixes the P4-flagged `nodeMap` leak) | L240–L252 (map cleanup L246–L247) |
| src/NodeEditor.jsx | `keypress`: early-return when `document.activeElement.isContentEditable`; `selectedBlocks?.length` crash fix (P1-7) | L466–L479 (guard L471) |
| src/NodeEditor.jsx | `lineExists(idFull1,idFull2)` + validated `addConnectorFromTo` (P1-2): throws on unknown connector / same connector / existing pair (either direction) | L552–L560 / L569–L580 |
| src/NodeEditor.jsx | `GraphState` typedef, `saveGraph()`, `loadGraph(state, typeMap)` (P1-6) | L595–L640 (save L607, load L624) |
| src/NodeEditor.jsx | `destroyed` flag, `destroy()` (backward iteration — `removeLine`/`removeBlock` splice the walked arrays), `disconnectedCallback` → `destroy()` (P1-4) | L702–L731 |
| src/connectorUtil.js (103) | import `observeShowHide` (L3); new connectors get `el.removeObserve = observeShowHide(el, e => if ratio 0 → editor.removeConnector(con), {root: block el})` (P1-3) | L46–L57 |
| src/EditableTitle.js (45, rewritten) | `commit()` removes contenteditable + fires `change` only if text differs; pointerup stores `old` then enables/focuses+selects; Enter commits, Escape restores; blur commits only while editable (P1-7) | whole file |
| src/index.jsx (131, was 100) | demo persistence (P1-6/8): `saveGraph()`→`ne.graph` on `ne-move-done` **and** `onne-remove` (L70); boot = load `ne.graph` else migrate `ne.positions` into default graph; `typeMap` factories L83–L86; `window.editor` dropped | saveGraph L26–L37, editor L57–L73, boot L103–L129 |
| CHANGELOG.md | `Unreleased` entry: v2 breaking rename `lineinteraciton`→`lineinteraction` (P1-5; file says "generated", note added anyway per task) | L5–L11 |
| dist/index.d.ts + dist/src/NodeEditor.d.ts (274) | regenerated via `bun run tsc`; new public API emitted | — |
| smoke/p1.test.jsx + p1.run.mjs (new) | happydom smoke suite, 45 assertions | — |

## Verification

- `node smoke/p1.run.mjs` (esbuild-bundles the real sources, boots happy-dom, IO stubbed) → **ALL SMOKE ASSERTIONS PASSED** (duplicate-id throw; self/unknown/duplicate connector throws; `removeConnector` idempotent + orphan-line cleanup; save/load round-trip incl. fresh elements + positions; Delete-guard; EditableTitle Enter/Escape/blur; alias; destroy/disconnect).
- `bun run tsc` PASS; `bun run build` PASS; dev server `bun run start` on :5111 (job still running); `GET /` and `/index.js` 200; served bundle contains all P1 strings and **no `window.editor`**.
- oxfmt `--check` clean on all changed JS/JSX. Root `bun run check`/`bun install` remain sandbox-blocked (spawn EPERM), as in P0.

## Impact on P2

- **Persistence API:** `saveGraph(): {blocks:[{id,type,pos}], lines:[[idFullA,idFullB]]}` — `type` is whatever `add(block,id,{type})` received. `loadGraph(state, typeMap)`: clears first; `typeMap[type]` must be a **factory** returning a FRESH element; throws `no factory registered` on missing entry; reconnects via `addConnectorFromTo` (inherits its throws). localStorage key: `ne.graph`.
- **"Structurally changed" signal (P1-3):** `ne-remove` is still fired on `con.el` (bubbles to editor element via `fireCustom` — demo persists via `onne-remove`); the authoritative cleanup path is `editor.removeConnector(con)`, also auto-run when a connector element leaves the DOM (block-root IntersectionObserver → ratio 0); every connector element carries `el.removeObserve` (dispose fn). `removeBlock` no longer orphans lines and frees the block id.
- `editor.destroy()` on element disconnect — P2 widgets must not assume the editor outlives DOM removal; `lineinteraction` is the blessed spelling (`lineinteraciton` still works, gone in v2).
- Note: task-file line numbers predate P0+P1; use the table above. Remaining quirks: `blockData.resizeSet` never refreshed by `recheckConnectors` (P3); `forEachProp` import unused in index.jsx; CHANGELOG manual-entry caveat above.
