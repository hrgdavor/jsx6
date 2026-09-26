# Task P3 summary — nodditor performance

**Status:** done. All 5 changes (P3-1…P3-5, incl. the optional one) applied; 51 new smoke assertions pass, P1's 45 and P2's 68 still pass.

## Changes (file → what changed → lines AFTER; this table is the new line-number authority)

| File | Change | Lines after |
|---|---|---|
| src/NodeEditor.jsx (**1507** lines, was 1250) | typedefs: `BlockData.structDirty`, `ConnectorData.movedStamp`; module helper `microtask` | L40–41 / L61–62 / L82 |
| src/NodeEditor.jsx | **P3-1** `findConnector` memoized on "structurally changed". Signal = ONE canvas-wide `MutationObserver` (`ensureStructObserver`, `contentArea`, childList+subtree, record→owning block via `nodeMap`) — P1-3 shipped removal tracking (IntersectionObserver), not the MutationObserver P3-1 assumed, so it was purpose-built here. `add` starts a block dirty (L165); called from `tpl` L548 | L184–199, L207–216 (`resizeSet` now live, L210), L224–234, L241–254 |
| src/NodeEditor.jsx | **P3-2** moved connectors are queued (`queueMove`) and flushed as ONE `ne-move` (`flushMoves`, `detail={stamp,connectors}`, `con.movedStamp` L291). Per-connector element events are **gone**. `_setPos` L432 queues; RO handler L526–531 (`consChanged` L480/503 narrows to the one connector); state init L463–473 | L261–270, L281–295 |
| src/NodeEditor.jsx | **P3-2** drag / canvas-pan / marquee coalesced per animation frame (`applyDrag`/`applyPan`/`flushMarquee`, pending state cancelled by `pointerdown`, flushed by `pointerup` so undo snapshots final positions); `fireMove` flushes the batch FIRST (L1502) so `ne-move` never follows `ne-move-done` | L607–641, L676–690, L709–715, L794–822, L1497–1507 |
| src/NodeEditor.jsx | **P3-3** `selectBlocks` uses `new Set(blocks)` → `selSet.has(p)` (was `blocks.includes(p)`, O(sel×blocks)); block ids unchanged | L1226, L1254, L1258 |
| src/NodeEditor.jsx | **P3-4** `fireMoveDone`: `setTimeout` dropped, menu re-shown + repositioned synchronously; `destroy()` releases `_structMO`, the menu size cache/observer and the pending queues | L1483–1495, L1423–1450 (menu L1432–38, MO L1443, queues L1446–49) |
| src/connectorUtil.js (123) | `findConnector(blockData, force)` returns `{resizeSet, cached}` and skips the walk (+ `getComputedStyle`/`calcPos`) when `!structDirty`; clears the flag after walking. `recalcPos`/`updatePos`/`addResize` unchanged | L28–39 (early return L30–33), L103, L113, L121 |
| src/moveMenu.js (44) | **P3-4** menu box measured ONCE and cached on the element in **unscaled** px (`_neMenuSize`, zoom-safe), invalidated by a MutationObserver on the menu (`_neMenuObs`); a 0-sized (hidden/uninserted) menu is never cached; `menu.moveMenu` override hook kept | L16–31, L36–44 |
| src/LineInteraction.js (185) | **P3-5** `document.elementFromPoint` runs at most once per frame (`hoverStep`/`scheduleHover`/`flushHover`), flushed on `pointerup` so no connect is lost; also null-safe (`target2?.ncData`) | L52–99 (call L69), pointermove L156, pointerup L163–164 |
| src/ConnectLine.js (159) | endpoint listeners migrated to the batch: `listenCustom(editor,'ne-move', d => d.stamp===con.movedStamp …)` with a per-element fallback for connectors without an editor; `ne-remove` listener unchanged | L68–79 |
| src/index.jsx (171) | reference consumer handles BOTH detail shapes: block `{nid,…}` and batch `{stamp,connectors}` | `points` L13, `onMove` L25–36 |
| CHANGELOG.md / dist / smoke | P3 entries under Unreleased (L23–37) + `ne-move` behavior-change note; `bun run tsc` regenerated `dist/`; smoke/p3.test.jsx (311) + p3.run.mjs (56, stubs IO and a drivable ResizeObserver) | — |

## Verification (commands actually run)

- `cd apps/nodditor; node smoke/p3.run.mjs` → **ALL SMOKE ASSERTIONS PASSED** (51; incl. 200 blocks × 801 connectors: 60 pan frames → **60** `ne-move` events, 735 ms; resize → **0** subtree walks; menu measured once for 3 placements).
- `node smoke/p2.run.mjs`, `node smoke/p1.run.mjs` → both **ALL PASS** (multi-select, undo, zoom, marquee, connect unaffected).
- `bun run tsc` (exit 0) + `bun run build` (**BUILD SUCCESS**); `bun run format apps/nodditor` then `bun run format:check apps/nodditor` → clean.
- Dev server: `GET http://127.0.0.1:5111/` → 200 and the served `index.js` (48233 B) contains `movedStamp`, `structDirty`, `flushMoves`, `ensureStructObserver`, `_neMenuSize`. The `:5111` listener is an orphan live-server whose watcher stopped rebuilding; `build_dev/` was refreshed with a one-off `buildScript('./src','build_dev','index.jsx',{jsxDev:true,…})` (helper deleted). No DevTools profiling was possible from this environment — the 200-block stress is measured by the smoke suite instead.
- `ne-move` consumers: `index.jsx` `onMove` records every connector snapshot keyed by `idFull` and every block by `nid` (asserted); `ConnectLine` lines follow their endpoints (asserted).

## Impact on P4 (dead code / references)

- **`@jsx6/dom-observer` IS used** — `connectorUtil.js` L3 imports `observeShowHide`, called at L71 (P1-3 connector cleanup). **Keep** package.json L64.
- The stale `// todo remove lines connected to it` comment is **gone** (no `todo` left in NodeEditor.jsx); that behavior lives in `removeConnector` L363–380.
- Newly dead code for P4: `lx`/`ly` in LineInteraction.js (L32–33, written L103–104, never read); `contentRect` destructured but unused in the RO handler (NodeEditor L483); `updateObserver()`'s `removed` return value unused; `ConnectLine.js` stale `// todo box pos` comments L132/L136; `index.jsx` `menu.afterAdd` L102–104 (body reads `blocks[0]`, unused) and commented code L31–35, L117, L171.
- Do not break when cleaning: batched `ne-move` (`detail.{stamp,connectors}` — the per-connector element event is intentionally gone), `structDirty`/`movedStamp`, `_moveQueue/_moveScheduled/_moveStamp`, `_recheckQueue/_recheckScheduled`, `_structMO`, `menu._neMenuSize/_neMenuObs`.
- Line numbers P2 reported for P4 are superseded: RO handler L476–533 (was L326–379), `recheckConnectors` L207 (was L158), `_setPos` L427 (was L289), `selectBlocks` L1226 (was L995), `fireCustom` L1471 (was L1220), `fireMoveDone` L1483 (was L1232/L1238), `findConnector` L28 (was L13), LineInteraction `elementFromPoint` L69 (was L85/L107), `moveMenu` L36 (was L7).
