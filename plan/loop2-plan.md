# `@jsx6/loop2` — Loop v2: design, inventory and implementation plan

**Created:** 2026-10-12
**Scope:** new package `libs/loop2` (`@jsx6/loop2`). Nothing in `libs/jsx6` or `libs/w` is modified by
this change — the two existing Loops keep their behaviour, which is the whole point of a separate
package.
**Status:** P0 delivered (library, tests, README, this plan). P1–P4 are the phased adoption plan (§5);
P5 (windowed rendering with `@jsx6/virtual-scroll`) is delivered too — see §5 P5 for what shipped and
what it measured.
**Related:** [keyed-loop-design.md](./keyed-loop-design.md) (the `Loop` key contract),
[disposal-design.md](./disposal-design.md) (teardown + the reuse-pool rule),
[improvement-plan.md](./improvement-plan.md) (P0-3, P0-4, P2-1, P2-2, P3-2),
[implementation-status.md](./implementation-status.md) (§7).

---

## 1. Inventory — everything about `Loop` in this repository

### 1.1 The two implementations

|                | `libs/jsx6/src/Loop.js` | `libs/w/src/Loop.js`                                                                |
| -------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| size           | 661 lines, class at [L109](../libs/jsx6/src/Loop.js#L109), `LoopItem` at [L639](../libs/jsx6/src/Loop.js#L639) | 295 lines, class at [L28](../libs/w/src/Loop.js#L28), `LoopItem` at [L273](../libs/w/src/Loop.js#L273) |
| host model     | plain object; the DOM gets an anchor **text node** (`this.el`, [L135](../libs/jsx6/src/Loop.js#L135)) | `HTMLElement` custom element `jsx6-loop`, `connectedCallback`/`disconnectedCallback` ([L79](../libs/w/src/Loop.js#L79)), `outside` option |
| reconciliation | keyed (P2-2): `keyMap`/`_itemKeys`/`_dataKeys` ([L117](../libs/jsx6/src/Loop.js#L117)), four-pass `setValue` ([L234](../libs/jsx6/src/Loop.js#L234)) | index only: `setValue` calls `setItem` per datum ([L92](../libs/w/src/Loop.js#L92)) |
| mutation paths | `setValue`, `setItem` ([L327](../libs/jsx6/src/Loop.js#L327)), `_claimParked` ([L361](../libs/jsx6/src/Loop.js#L361)), `push`/`pop` ([L536](../libs/jsx6/src/Loop.js#L536)), `splice` ([L580](../libs/jsx6/src/Loop.js#L580)) — four hand-written paths | `setItem`, `push`, `pop`, `splice` ([L236](../libs/w/src/Loop.js#L236)) |
| DOM ordering   | `_orderDom` ([L481](../libs/jsx6/src/Loop.js#L481)) — walks backwards, mutates only what is out of place | none (relies on `insert` calls) |
| teardown       | `dispose` ([L176](../libs/jsx6/src/Loop.js#L176)), `disposeItem` ([L209](../libs/jsx6/src/Loop.js#L209)), anchor disposer, the P2-1 contract | none |
| tests          | `src/Loop.test.js` (439 lines / 18 cases), `src/dispose.test.js` (3 Loop cases at [L194](../libs/jsx6/src/dispose.test.js#L194), [L227](../libs/jsx6/src/dispose.test.js#L227), [L254](../libs/jsx6/src/dispose.test.js#L254)), `src/browser.test.js` ([L70](../libs/jsx6/src/browser.test.js#L70)) | `src/Loop.test.js` (110 lines / 4 cases) |

`plan/improvement-plan.md` P3-2 ([L212](./improvement-plan.md#L212)) records the conclusion: **two
divergent Loops**, with `@jsx6/w`'s copy named the canonical one; `plan/keyed-loop-design.md` §9
([L278](./keyed-loop-design.md#L278)) adds that the keyed work in `libs/jsx6` was *not* ported to
`libs/w`, deliberately, and lists what a port would have to handle (connect/disconnect re-insert,
`outside`, no disposal machinery).

### 1.2 The design notes that describe the current behaviour

| note                                                   | what it settles |
| ------------------------------------------------------ | --------------- |
| [keyed-loop-design.md](./keyed-loop-design.md)         | the `key`/`loopKey`/`$key` contract (§2, [L31](./keyed-loop-design.md#L31)), the four-pass algorithm and `_orderDom` (§3, [L103](./keyed-loop-design.md#L103)), duplicates/missing keys (§4), the interaction with the reuse pool (§5, [L175](./keyed-loop-design.md#L175)), the evidence table (§6), **eight documented limitations (§7, [L235](./keyed-loop-design.md#L235))** and the rejected alternatives (§8) |
| [disposal-design.md](./disposal-design.md)             | the `jsxDisposeSymbol`/`addDisposer`/`disposeNode` contract, **the "Loop reuse caveat" (§4, [L83](./disposal-design.md#L83))**: hidden items are detached but never disposed because disposing them would render stale content on re-insert; `disposeItem`/`dispose` as the only permanent paths; `ondestroy()` (§5) |
| [improvement-plan.md](./improvement-plan.md)           | P0-3 ([L162](./improvement-plan.md#L162)) `todomNode` typo in `moveItem`; P0-4 ([L163](./improvement-plan.md#L163)) `this.itemNextSibling` assigned nowhere → two wasted mutations per removed item; P2-1 ([L201](./improvement-plan.md#L201)) no teardown anywhere; P2-2 ([L202](./improvement-plan.md#L202)) `key` inert, index-only reconciliation; P3-2 ([L212](./improvement-plan.md#L212)) three component models, two Loops |
| [implementation-status.md](./implementation-status.md) | item 7 ([L256](./implementation-status.md#L256)): three of the same defects were fixed in `libs/w`'s Loop too (`connected`/`lastValue` never assigned, `_remove`/`_fixItemList` treating components as elements so **removing an item never detached it**, the same self-assigning ternary); §7 ([L272](./implementation-status.md#L272)): P2-2 is implemented in `libs/jsx6` only |
| `MODULE_VERSIONING.md` / `scripts/versions.json`       | `@jsx6/jsx6` and `@jsx6/w` are **lockstep** packages (1.19.1); a new library has to be registered in both files or the manifest audit fails |

### 1.3 Loose ends found while collecting this

1. **`apps/repl/src/Loop2.test.js`** ([10 lines](../apps/repl/src/Loop2.test.js)) is an unrelated
   scaffold (`test('snap 1')` asserting that `<div>` is a DIV). It is *named* `Loop2` and predates this
   package; the name now collides with the real thing. P4's dead-code list
   ([nodditor-task-p4.md](./nodditor-task-p4.md)) treats it as "the only existing app test", which
   overstates its value. Recommendation: delete or rename it (§7.13).
2. **`@jsx6/scloop`** ([libs/scloop/index.js](../libs/scloop/index.js)) is a retired stub (`export {}`,
   `"private": true`) whose reserved feature "lives in `@jsx6/virtual-scroll`" (P0-8,
   [L167](./improvement-plan.md#L167)). It is not a Loop, but it is the closest thing to a naming
   precedent for list rendering; the new package is named `loop2`, not `scloop`, deliberately.
3. **`@jsx6/virtual-scroll` already has a key extractor**: `getKey`, `(item) => string|number`,
   default `item.id` ([README L108](../libs/virtual-scroll/README.md#L108),
   [src/virtual-scroll.js L60](../libs/virtual-scroll/src/virtual-scroll.js#L60)). `Loop2`'s `keyBy`
   is the same idea; the two should share a type and eventually a windowing story (§7.8, §7.4).

---

## 2. What `Loop2` has to fix

The eight limitations `plan/keyed-loop-design.md` §7 records, plus the structural ones it does not:

| #   | problem today                                                                       | `Loop2`                                                                                     |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | fresh datum objects cannot be matched by a template-only key (`§7.1`)               | **`keyBy(data, i)`** — the key is read from the datum before any item exists                |
| 2   | the item's declared key is frozen (`§7.2`)                                          | unchanged, but documented; `keyBy` makes it irrelevant for the common case                  |
| 3   | `$key` is overloaded with `p` (`§7.3`)                                              | unchanged (only `loopKey` is read on elements); `keyBy` avoids the collision entirely       |
| 4   | class-component items get their key from the data (`§7.4`)                          | unchanged; `keyBy` removes the constraint                                                   |
| 5   | fragment keys are read from the first node only (`§7.5`)                            | key reading unchanged; fragment **attach/detach/index** is fixed (see §6)                   |
| 6   | primitives can never be keyed (`§7.6`)                                              | **keyed primitive loops** via `keyBy`                                                       |
| 7   | no `keyBy`/`getKey` extractor (`§7.7`, kept as an open question)                    | **implemented** here, opt-in, with the `$key`/`loopKey` path still the default              |
| 8   | `setItem(data, i)` beyond the end creates holes, unchecked (`§7.8`)                 | `i === count` grows the list; anything else throws `RangeError`                             |
| 9   | **four mutation paths** (`setValue`/`setItem`/`splice`/`push`,`pop`) with subtly different key handling — the source of P0-3/P0-4 and of "keyed data behaves differently in `push` than in `setValue`" | **one reconciliation** for every mutation; each mutation is an array edit followed by that reconciliation |
| 10  | the reuse pool is unbounded — a list that once showed 10 000 rows keeps 10 000 detached items for the loop's lifetime (`disposal-design.md` §4) | **`maxPooled`** + `releasePool(keep)` |
| 11  | `setValue` throws `JSX6E8` when the loop is not attached yet (measured, §6) — this is exactly why `@jsx6/w`'s Loop needs `connectedCallback` | detached-safe `insert` + `refresh()` |
| 12  | a fragment item leaves a stray `[object Object]` text node on first attach (measured in `@jsx6/jsx6`, §6) | the resolved nodes are inserted; every node of a fragment is indexed  |
| 13  | `getItemIndex` depends on a mutable `loopIndex` stamp on the node                   | an internal index map over items *and* their nodes, with the stamp kept for compatibility   |
| 14  | `removeItem` silently returns in `libs/w`, and removes a parked item in `libs/jsx6` | throws `JSX6E12` for anything outside the visible range; `disposeItem` for parked instances |

---

## 3. Design decisions

1. **A separate package, not a new export in `@jsx6/jsx6`.** `@jsx6/loop2` can be adopted per app and
   per list, and it can break with `Loop`'s accidental behaviour (mutation API, holes, detached
   building) without endangering existing code. P3-2 already warns that fixing bugs in two copies is
   the trap; a third copy is only justified if it is the one that survives — hence §5's deprecation
   phase.
2. **Plain object with an anchor text node** (like `Loop`), not an `HTMLElement`. It works in jsx6 and
   in `@jsx6/w` templates (`h(Loop2, …)` is inserted through `forInsert`, which unwraps `.el`), it
   needs no `define()`/`connectedCallback` dance, and the w-specific lifecycle is what §5 P2 adds as a
   thin custom-element wrapper for the `outside` use case.
3. **One reconciliation.** `setValue` stores a copy of the data in `this.data`; `push`, `pop`, `splice`
   and `moveItem` edit that copy and call the same `_reconcile()`. `push` keeps a fast path for the
   common append (O(1)-ish) and falls back to the reconciliation when a keyed item has to be moved.
4. **`keyBy` is opt-in and additive.** The `$key`/`loopKey`/template-key sources stay, in the order
   `keyBy` → datum → learned template key. `undefined`/`null` from `keyBy` falls through, so a partial
   extractor is possible (`keyBy: (row, i) => row.id ?? \`row-${i}\``).
5. **`strictKeys` is opt-in** because the strict rule ("a new key never inherits another key's item")
   is a behaviour change for lists that rely on recycling the freed slot. Default `false` = `Loop`.
6. **`maxPooled` defaults to `Infinity`** for the same reason: no silent change in retention. Apps that
   want bounded memory set a number; `releasePool(0)` empties the pool on demand.
7. **Items are indexed by an internal `Map`** (`_idx`) built in the same pass that stamps
   `loopIndex`, so `getItemIndex` does not depend on a stamp that a foreign loop may have written.
8. **The error code stays `JSX6E12`** so error handling does not fork, but the number is duplicated
   locally because `@jsx6/jsx6`'s `index.js` does not re-export `errorCodes.js` (§7.3).
9. **Item construction is a local copy of `LoopItem`** (`Loop2Item`), documented as structurally
   compatible. Sharing the item shape keeps templates portable, while the copy keeps this package
   independent of `Loop`'s internals until the consolidation in §5 P4 happens.
10. **Disposal contract unchanged**: hiding detaches, never disposes; `disposeItem`/`dispose`/pool
    trimming release bindings; the anchor's disposer tears the loop down through
    `remove()`/`replace()`.

---

## 4. What is delivered in this change (P0)

```
libs/loop2/
  package.json      @jsx6/loop2 1.0.0, standalone, exports/types/build scripts, deps: @jsx6/jsx6, @jsx6/signal
  jsr.json          version kept in sync (checked by scripts/check-manifests.js)
  tsconfig.json     JSDoc checkJs + declaration emit, tests excluded (libs/jsx6 convention)
  index.js          export * from './src/Loop2.js'
  src/Loop2.js      Loop2 + Loop2Item
  src/Loop2.test.js 27 cases
  README.md         options, keys, API, pool/disposal, migration, recommendations
```

Registered in `MODULE_VERSIONING.md` (Standalone Modules), `scripts/versions.json`
(`libs/loop2: 1.0.0`) and `bun.lock` (`bun install` linked the workspace package), without which the
manifest audit and a clean `bun install --frozen-lockfile` fail. AGENTS.md's knowledge table gained a
row pointing at the README and this plan.

**Evidence collected while implementing** (all commands run from the package directory unless noted):

| check                                                            | result                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `bun test`                                                       | 27 pass / 0 fail, 143 assertions                                                         |
| `bun test` (root, every package)                                 | all packages pass; the gate discovers `libs/loop2` as `bun test (libs/loop2, 1 file(s))` |
| `bun check`                                                      | ✓ no type errors in 3 files                                                              |
| `bun run types`                                                  | `dist/index.d.ts` + maps emitted                                                         |
| `bun run build` / `build-cjs`                                    | `esm/index.js` 16.5 kB, `cjs/index.js` 17.0 kB                                           |
| `bun x oxlint libs/loop2 --deny-warnings`                        | 0 warnings, 0 errors                                                                     |
| `bun x oxfmt --check libs/loop2 scripts/versions.json`           | clean                                                                                    |
| `bun run scripts/check-manifests.js` (with `npm pack --dry-run`) | passed, 0 warnings — the tarball ships the entry points and no test files                |
| `bun run scripts/check-workspace.js`                             | passed (20 packages, no version drift)                                                   |
| `bun run check --no-format` (full gate)                          | **all steps PASS**: tests, tsc 7 declarations, `bun check`, oxlint, versions, docs sync, manifest audit, workspace integrity |

---

## 5. Implementation plan (phases)

### P0 — the library (done)

Deliver `libs/loop2` as described in §4. Acceptance: the package passes `bun test`, `bun check`,
`bun run types`, both builds, oxlint and the manifest audit; nothing outside `libs/loop2` and the two
registration files changes.

### P1 — dogfood one real list

Use `Loop2` for **one** list in **one** app, behind a normal code change (no flag needed if the diff is
small), and compare against the `Loop` it replaces:

- candidate A: `apps/nodditor`'s block list / connector list (it already keeps geometry caches and
  selection state per block — exactly what must survive a reorder);
- candidate B: `apps/repl`'s tutorial file/step list.
- Acceptance: identical rendered DOM in the demo; selection/focus survives a reorder that today loses
  it; `onBuild` count unchanged across a reorder (the metric the plans already use).
- Evidence: a test in the app plus the two manual checks (demo behaviour, rebuild count logged).

### P2 — reach `@jsx6/w` users

`Loop2` is a plain object, so a `JsxW` template can already use it, but the `outside`/custom-element
workflow and `connectedCallback` re-insert have no equivalent:

- add `libs/loop2/src/Loop2Element.js` — a `<jsx6-loop2>` custom element that wraps `Loop2`, forwards
  the option object, re-inserts items in `connectedCallback` (via `refresh()`) and disconnects on
  `disconnectedCallback`;
- it must not call `define()` at import time unless the caller asks (`defineLoop2()`), because
  `sideEffects: false` is declared and `@jsx6/w`'s `define()` is the existing pattern;
- port the 4 cases of `libs/w/src/Loop.test.js` to it.
- Acceptance: a `JsxW` app renders, reorders, and reconnects after a DOM move with keyed identity
  intact.

### P3 — deprecate, do not triplicate

- Mark `@jsx6/jsx6`'s `Loop` and `@jsx6/w`'s `Loop` `@deprecated` in JSDoc (P3-2's own instruction),
  pointing at `@jsx6/loop2` and this plan; keep both exported until the next major.
- Move the key contract documentation to one place: keep `plan/keyed-loop-design.md` as the history of
  the `Loop` implementation, and let `libs/loop2/README.md` own the current contract.
- Add a short "which loop should I use" table to `docs/stack/components.md` and to
  `apps/nodditor/README.md` where lists are rendered.
- Acceptance: `bun run check` green, with no behaviour change in the two old Loops.

### P4 — performance, benchmarks and the shared core

- Add `libs/loop2/bench/list.bench.js` (Bun script, not part of the gate) measuring: 10 000-row
  `setValue`, rotation of 1 000 keyed rows, 1 000 `push`es, `maxPooled` trimming, and the unkeyed
  index path versus `Loop`.
- Record the numbers in this plan so later claims have a baseline (the repo's evidence style).
- Decide the shared core: extract `keyValue`/`dataKey`/`itemKey`/`nodesOf`/`_orderDom` into
  `@jsx6/jsx6` internals (or a small `@jsx6/list-core`) so the three copies stop drifting — or delete
  `Loop` in the next major, which removes the problem instead of sharing it.
- Acceptance: a regression threshold (for example "no worse than `Loop` by more than 10 % on the
  unkeyed path"), documented next to the numbers.

### P5 — windowed rendering with `@jsx6/virtual-scroll` (done, 2026-10-12)

The real payoff of keyed identity plus a bounded pool is recycling a window. Delivered **without a
dependency in either direction**: the two packages agree on a contract and are pinned against each
other by a dev-only integration test.

| change                                                                                      | where                                                                                     |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `setWindow(slice, startIndex)` / `getWindow()` / `absIndex(i)` / `getAbsoluteIndex(item)`, and every reported index absolute (`keyBy`, `onBuild`, `attr.i`, `$i`, `__loop2Index`) | [libs/loop2/src/Loop2.js](../libs/loop2/src/Loop2.js) |
| mutation API refuses a windowed loop; `setValue` resets the origin to 0                     | same                                                                                      |
| `virtual-scroll`'s `getKey` gains the index: `getKey(item, index)`, so one function serves both `keyBy` and `getKey` | [libs/virtual-scroll/src/virtual-scroll.js](../libs/virtual-scroll/src/virtual-scroll.js) |
| robustness ported from `virtual-scroll`: a throwing builder/setter/hook cannot orphan a node, and an aborted pass rolls back items, keys, data and origin | `Loop2._reconcile`          |
| per-frame hooks a recycling host needs: `onPark`/`onRestore` (the `onItemPooled` equivalent), `onDuplicateKey` (once per key per reconciliation), `onBeforeMove`/`onAfterMove` (FLIP), `domMoves` (the mutation metric) | `Loop2` options |
| one key function handed to both, 100 000 rows, bounded node count, identity on the way home | [libs/loop2/test/virtual-scroll.integration.test.js](../libs/loop2/test/virtual-scroll.integration.test.js) |

Findings that shaped the implementation:

1. **A windowed "scroll" usually builds nothing.** The items that leave the window are reused for the
   rows that enter it, so a one-row scroll of a 5-row window costs **0 builds and 1 DOM move**; the
   loop holds `count + maxPooled` items for the whole journey (100 000 rows, `maxPooled: 2`, never more
   than the window plus 2). Pinned by the windowed suite.
2. **A recycled row is not "parked".** `onPark`/`onRestore` report items entering and leaving the
   visible set, so a row that is handed straight to the next one is reported as neither — that is the
   same rule `virtual-scroll` applies with `onItemPooled`. The row each hook saw is passed as the
   hook's second argument, because the pass has already renamed the item by the time a hook runs.
3. **The index fallback may reuse a freed slot only.** This was investigated and needs no extra guard:
   pass 1 claims the item that owns every key the new list still renders, so by the time the index
   fallback runs, an item that owns a wanted key is already spoken for. What is left at a position is a
   genuinely free slot, and reusing it (state included) is `Loop`'s documented behaviour, with
   `strictKeys` as the opt-out. A guard was written here first and then **removed**: an instrumented run
   of every suite plus six adversarial keyed scenarios (insert-new-key-at-taken-index, drop-and-replace,
   full key replacement, move-plus-new-key, shrink-regrow, keyed→unkeyed) recorded **zero** hits, so it
   was dead code, not a fix. See §8 "claims checked and withdrawn".
4. **Windowing requires keys.** With unkeyed data the index fallback renumbers a slice of a slice, so
   `setWindow` documents the requirement and the mutation API refuses to run on a window.

Acceptance met: a 100 000-row list scrolls with a bounded node count, no instance built twice, and
item state surviving the window leaving and returning (the integration test walks the list, checks the
ceiling and asserts instance identity after a full round trip).

### P6 — the type axis (done, 2026-10-12)

A row's identity has a second axis: **what kind of row it is**. `typeBy(data, i)` — the same shape as
`keyBy`, and the same fallback chain (`data.loopType` / `data.$key.type` → the type of the key `keyBy`
returned) — puts every row in a type, and **only rows of the same type share reuse slots**, index
fallback included. A list that mixes headers and rows, group rows, or system messages can no longer
render one kind into an item built for another.

| change                                                                  | where                                                                       |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `typeBy`, `typeOf(item)`, `keepTypes(types)`; a falsy type (`undefined`, `null`, `''`, `0`) is untyped and shares the default slot | [libs/loop2/src/Loop2.js](../libs/loop2/src/Loop2.js) |
| the type is carried by the *item* (`_itemTypes`) and its pool (`_pools` maps `type → items`); `maxPooled` is the total across pools, released least-recently-parked first | same |
| the type reaches a custom `builder` as `opts.type`                      | same                                                                        |
| keys stay **global** across types: the type decides reuse, not identity | same                                                                        |
| 8 cases: cross-type index fallback, per-type pools, falsy types, `keepTypes`, `typeOf`, builder plumbing | [libs/loop2/src/Loop2.types.test.js](../libs/loop2/src/Loop2.types.test.js) |

Findings worth keeping:

1. **`strictKeys` compares against a pre-pass snapshot, not the live key map.** The rule ("a new key
   never inherits another key's item") has to be checked against the keys owned *before* the pass,
   because the pass renames items while it works — the live key map no longer describes the state the
   rule is about. A pass collects the keys it dropped (`legacyKeys`) right after the keyed pass and
   rejects an item parked under one of them. Pinned by the `strictKeys` case in
   [libs/loop2/src/Loop2.test.js](../libs/loop2/src/Loop2.test.js).
2. **The pool must start from everything the loop owns.** An earlier version built it from "already
   parked items" only, which made a scroll rebuild the row it had just taken off screen instead of
   recycling it — caught by the P5 one-row-scroll test (`built.length` was 6 where 5 is correct).
3. **`virtual-scroll` still does not support types** (one fixed `itemHeight`, one row factory): the
   loop keeps the grouping, and a mixed-kind window is the host's problem. `keepTypes` is the one call
   a windowed host needs when a window stops containing a type, so those items do not occupy pool slots
   forever.

### P7 — one implementation or two? (decided, 2026-10-12)

The question was whether the typed loop should be a **separate component/class** from the single-type
one. Decision: **no — one `Loop2`, `typeBy` opt-in**, and the single-type path pays for it only in
proportion to what it uses. That is what this repository already does with every strategy option
(`primitive`, `worldWidth`, `hiddenClass`, `eager`, `device`), and the survey below found no package
that ships a second class for a strategy.

**Measured**, `bun run bench` — [bench/run.mjs](../libs/loop2/bench/run.mjs), each case in its own
process, median of 5-20 runs, real DOM in a detached container; 10 000 rows, 1 000-row rotation, a
20-row window over 10 000 rows:

| case                                              | untyped  | typed    | delta   |
| ------------------------------------------------- | -------- | -------- | ------- |
| `build` (10 000 rows)                             | 217 ms   | 219 ms   | +0.6 %  |
| `rotate1k` (keyed reorder)                        | 39.1 ms  | 39.9 ms  | +2.0 %  |
| `window` (400 window shifts)                      | 19.9 ms  | 21.0 ms  | +5.4 %  |
| `unkeyed` (same kinds land on the same positions) | 1 008 ms | 979 ms   | -2.8 %  |
| `unkeyedRetyped` (each rotation moves the kinds)  | 984 ms   | 3 065 ms | +211 %  |
| `push` (1 000 appends)                            | 4 885 ms | 4 771 ms | -2.3 %  |
| `shrink` (10 000 → 100)                           | 0.23 ms  | 0.24 ms  | +4.4 %  |

So: with the type axis opted into but the types **not moving**, the overhead is **≤ 3 %** on every case
(`window`'s +5 % is inside this machine's run-to-run noise) — the machinery is a few WeakMap reads and a
`Map.get` per row off the derived key, not a scan. The one large number is the *feature*: when data
changes type at a position, the item there was built for the old type and is correctly **rebuilt**, so
retyping a whole list costs what building it costs. Two earlier measurements drove real fixes:

- `_typeOf` used to run for every row even without `typeBy` (one avoidable WeakMap read per row); the
  type is now resolved only when the loop can *have* types.
- The pool used to be scanned per position (`findIndex`), which made a typed list O(n²) once the index
  fallback stopped matching; the free check is now the `used` set at the pool head, with a scan only
  when that head is spoken for.

**Why not split**, in order of weight:

1. **The type axis is not a separate algorithm.** Every mutation, the DOM ordering, the pool trimming,
   the hooks, the disposal contract and windowing are shared. Only *which item a position may take*
   differs — one guard in the index fallback and one lookup in the pool. Two classes mean duplicating
   1 200 lines or introducing a shared base class, which is more surface than the guard it removes.
2. **Integration must not depend on the class.** A host that switches between single-type and
   multi-type data (the common case: a virtual-scroll list that later grows a header row) would have to
   swap components and re-mount every row, and `loop2`+`virtual-scroll` would need two hosts.
3. **The single-type path is measurably untouched** (table above), so the usual reason to split —
   "the fast path must not pay for the feature" — does not apply here.
4. **It is the repository's convention** (20 manifests, one `.` entry each; strategy options read by one
   runtime guard; a second class only when the *host or lifecycle* differs, e.g. `@jsx6/w`'s Loop as an
   `HTMLElement`).

What would justify a split (none is true today): the typed path growing its own DOM or lifecycle story;
a measurable regression on the untyped path; or the type machinery becoming a substantial part of the
bundle. The option boundary stays reversible — `Loop2` is unpublished, so a later split costs a wrapper,
not a migration.

**Single-type mode is what pairs with `@jsx6/virtual-scroll`**, exactly as P5 describes: `setWindow`,
`keepTypes` unneeded, `maxPooled` at the window size, and one key function for both. The integration
test drives that pairing over 100 000 rows; the type axis is transparent to it (`typeOf` is `undefined`
for every item, no `typeBy` is called).

---

## 6. Measurements taken for this plan

Two throwaway probes (`.tmp/`, not committed) established facts this plan relies on:

1. **Fragment items are mis-attached in `@jsx6/jsx6`'s `Loop`.** With
   `Item = ({ value }) => [h('B', null, value.x), h('I', null, value.y)]` and `loop.setValue([{ x: 1, y: 'a' }])`:

   ```
   innerHTML: "[object Object]<b>1</b><i>a</i>"
   childNodes: 4
    - 3 "[object Object]"     <- stray text node (makeItem inserts the component, not its nodes)
    - 1 "1"
    - 1 "a"
    - 3 ""                    <- the loop anchor
   ```

   `_orderDom` inserts the real nodes afterwards, which is why the content is correct while the stray
   text node stays. `Loop2` inserts `toDomNode(comp)` and indexes every node of the fragment
   (`libs/loop2/src/Loop2.test.js`, "an item template may render a fragment of nodes").

2. **`Loop.setValue()` cannot run while the anchor is detached:**

   ```
   Loop:  setValue while detached THREW -> Error: JSX6E8   (parent required)
   Loop2: setValue while detached OK, size = 1
   Loop2: after attach + refresh -> "<b>1</b>"
   ```

3. **DOM mutation counts from the test suite** (keyed list, `insertBefore` calls through the parent):
   unchanged `setValue` → **0**, `[a,b,c] → [b,c,a]` → **1**, `[b,c,a] → [a,c,b]` → **2 more**. Unkeyed
   reorders mutate nothing at all (values are swapped in place).

---

## 7. Further recommendations

Ordered by value per unit of risk. Everything here is *outside* the P0 change; each item says what it
costs and what it would prove.

1. **Add `keyBy` to `@jsx6/jsx6`'s `Loop` as an opt-in option.** Non-breaking (default `undefined`),
   and it removes the `$key`-injection hack (`loop.setValue(items.map(i => ({ ...i, $key: i.id })))`)
   that §2.4 of the keyed design note has to recommend today. `dataKey()` is the single place to
   extend; the four-pass `setValue` already consumes `_wantedKey()`. **Cost:** ~30 lines + tests in
   `libs/jsx6`. **Proves:** existing `Loop` users get the ergonomic fix without moving packages.
2. **Fix the fragment attach bug in `@jsx6/jsx6`'s `Loop`.** `makeItem` passes the component to
   `insert()` ([Loop.js L446](../libs/jsx6/src/Loop.js#L446)) where `forInsert()` cannot unwrap an
   array-valued `.el`; pass `toDomNode(comp)` instead (the `_fixItemList` path at
   [L461](../libs/jsx6/src/Loop.js#L461) already does). **Cost:** one line + one test. **Proves:** the
   measured stray `[object Object]` node disappears for fragment templates.
3. **Export `errorCodes.js` from `@jsx6/jsx6`'s `index.js`** (or export a `LoopError`). Sibling
   packages cannot reuse `JSX6E12_ITEM_NOT_FOUND` today, which forces `@jsx6/loop2` to duplicate the
   number — the kind of drift the `Symbol.for` comment in `dispose.js` warns about. **Cost:** one
   `export *` line + a collision check (the names are unique). **Proves:** no duplicated error codes in
   the published packages.
4. **Decide the direction of `Loop` vs `Loop2` explicitly.** Two published Loops plus a third would be
   P3-2 all over again. Recommended sequence: `Loop2` → dogfood (P1) → `@deprecated` on both old Loops
   (P3) → delete them in the next major (P4). If the maintainer prefers to keep `@jsx6/w`'s Loop
   canonical instead, then `Loop2`'s keyed reconciliation should be ported *there* and this package
   should be folded into `libs/w` — that is a decision to take before P2, not after.
5. **Make `Loop#getValue()` honest for primitive loops.** It returns whatever the item's accessor
   returns; for `primitive: true` that is the signal function, not the value. `Loop2` keeps parity and
   documents `getData()`, but a `getValue()` that resolves function-valued accessors would be less
   surprising — decide and document, with one test per shape (plain item, primitive item, class item).
6. **Invest in the reuse pool as a feature, not a caveat.** `disposal-design.md` §4 explains why hide
   must not dispose; the missing half is *when* it is safe to dispose. `maxPooled` is a blunt bound;
   better options worth prototyping: `releasePool()` on `visibilitychange`/idle, a pool budget in bytes
   rather than items, and an `onRelease`-driven metric exposed by the app (a "pool size" DevTools-ish
   readout in the nodditor demo).
7. **Observability as a documented recipe.** `onBuild`/`onRelease` exist so that the improvement plan's
   "rebuild count" is measurable without touching internals. Publish the recipe (count builds per
   `setValue`, assert it stays flat across a reorder) in the README and use it in an app test — the
   cheapest guard against an accidental rebuild loop (per-row signals re-subscribing on every update).
8. **Share the key-extractor type with `@jsx6/virtual-scroll`.** `virtual-scroll` has
   `getKey: (item) => string|number`; `Loop2` has `keyBy(data, i) => any`. A single exported
   `KeyBy`/`KeyOf` type (and an index argument in `getKey`) would let an app pass the *same* function
   to the windowing layer and the renderer — a prerequisite for P5.
9. **Animate moves where they happen.** `_orderDom` is the single place that knows a node moved; an
   optional `onBeforeMove(node)`/`onAfterMove(node)` hook is enough to implement FLIP animations
   without a second diff of the list. Keep it out of the default path (perf) and document it as the
   extension point.
10. **Accessibility guidance.** A keyed list is often a `listbox`/`list`/`grid`; document the
    `role`/`aria-setsize`/`aria-posinset` recipe (and whether `Loop2` should set `aria-posinset`
    automatically when `role` is present) rather than leaving it to each app. This is a documentation
    plus one small option, not a redesign.
11. **First-paint / hydration recipe.** `Loop2` renders synchronously once attached, and keys are
    stable, so a server-rendered list can be hydrated by rendering into the existing nodes
    (`setValue` matches keys and `_orderDom` moves only what is out of place). Write the recipe and one
    test; it also documents that `Loop2` never *adopts* existing nodes for items it did not build.
12. **Clean up the naming collisions.** Delete/rename `apps/repl/src/Loop2.test.js` (a 10-line
    scaffold) and mention `@jsx6/loop2` in `apps/repl`'s tutorial text if the REPL is used to teach
    lists. Also finish P0-8 by removing `libs/scloop` from the tree entirely now that the workspace has
    a real list package.
13. **Keep the item contract in one place.** `Loop2Item` duplicates `LoopItem`. If `Loop` is deleted in
    the next major (item 4), this copy becomes the only one — until then, any bug fix in the item shape
    must be applied twice; a comment in both files (this package has one) plus a test that asserts the
    item shape (`$v`/`setValue`/`$s`/`el`) is the cheapest guard.
14. **Document the `key` → `key` attribute side effect.** `key={value.id}` writes a `key="…"` attribute
    into the DOM (`insertAttr`), which shows up in snapshots and `innerHTML` assertions (it is in this
    package's tests). Either document it prominently or change `insertAttr` to keep `loopKey` without
    mirroring the attribute — a small, separate decision with a DOM-visible effect.

---

## 8. Rejected alternatives

| alternative                                                       | why not |
| ----------------------------------------------------------------- | ------- |
| **Subclass `Loop` and override `setValue`/`splice`**              | the keyed reconciliation, the pool, `_fixItemList` and the disposal paths are entangled private methods; an override would still leave four mutation paths, and the next `Loop` refactor would break the subclass silently |
| **Add `Loop2` as another export of `@jsx6/jsx6`**                 | every `Loop` user would pay for a second implementation in the bundle, and "not breaking existing code" would rest on JSDoc discipline instead of a package boundary |
| **Make `Loop2` an `HTMLElement` (copy `libs/w`)**                 | the custom element is the reason `libs/w`'s Loop cannot be populated before connect and has no disposal story; the plain-object shape already works in both component models |
| **Port the existing `Loop` file wholesale and edit it**           | it would carry the four mutation paths, the fragment bug and the stale-index lookup into a "new" library and make the diff against `Loop` unreadable |
| **Fix `Loop` in place instead (P2-2 style) and skip the package** | the API changes in §2 (item 8, 11, 14) are observable behaviour changes; doing them inside a lockstep package (1.19.1) would be a breaking release for `@jsx6/jsx6` and `@jsx6/w` at once, which the brief excludes |
| **`maxPooled: 0` as the default**                                 | it trades the documented reuse semantics (state survives remove/re-add) for memory; it must be opt-in, with `releasePool()` available for the "reclaim now" case |
| **Keyed primitives by value with no extractor**                   | the same primitive can legitimately appear twice, which would introduce ambiguous duplicate keys and change existing `primitive: true` behaviour (this is `§7.6`'s open question, answered by requiring `keyBy`) |

## 9. Claims checked and withdrawn

While building P6/P7 an audit tried to re-derive the defects this plan attributes to the existing
`Loop`. Five of those claims **did not reproduce** against the code as it stands. They are recorded here
so nobody re-reports them as open bugs — and so the wording below, where this file used to state them as
findings, is not trusted:

| claim                                                             | what the code actually does                                    |
| ----------------------------------------------------------------- | -------------------------------------------------------------- |
| `todomNode` typo in `moveItem`                                    | no such identifier exists anywhere in the tree — already fixed |
| `this.itemNextSibling` assigned nowhere, causing wasted mutations | no such identifier exists — already fixed                      |
| a keyed reorder loses item state                                  | instances and their state survive a reorder, an insert of a new key mid-list, and remove-then-re-add (`setValue` only calls `setter` on items it already owns) |
| class-component items are rebuilt by `setValue`                   | 3 constructions for 3 rows, still 3 after a reorder *and* after remove/re-add; a state field set on a live instance survived both |
| the index fallback lets a new key steal a visible key's item      | pass 1 claims every still-present key first, so only genuinely free slots are reused — the documented `Loop` behaviour, with `strictKeys` as the opt-in that forbids it |

A pass-2 key guard in `Loop2._reconcile` was written on the strength of that last claim and has since
been **removed**: an instrumented run of every suite plus six adversarial keyed scenarios
(insert-new-key-at-a-taken-index, drop-and-replace, full key replacement, move-plus-new-key,
shrink-regrow, keyed→unkeyed) recorded **zero** firings. The remaining `used` check is the real
protection and costs one `Set.has` per position.

The only defect in the existing `Loop` that **did** reproduce, by DOM inspection alone: a fragment item
template (one returning an array of nodes) leaves a stray stringified text node —
`"[object Object]<b>1</b><i>a</i>"`, 5 child nodes instead of 3. Content still renders, which is why it
does not surface in normal use. See §6 item 1.

Also corrected during this work, both real and both visible in §5 P7's table: a duplicated `keyBy` call
in the type path (the extractor ran twice per row) and a pool scan that made a typed list O(n²).

## 10. Open questions for the maintainer

1. Is `@jsx6/loop2` the intended destination, or should the keyed work land in `@jsx6/w` and this
   package be folded there before P1? (§7.4 — decide before P2.)
2. Standalone versioning starts at `1.0.0` for a first release with 27 tests and no external users. Is
   `0.1.0` preferable for an explicitly pre-adoption package?
3. Should `strictKeys` ever become the default (matching React/Solid identity semantics), with
   `strictKeys: false` kept as the migration escape hatch?
4. Should `getData()` exist at all, or is `getValue()` enough? It exists because `Loop2` keeps the data
   mirror anyway, and it is the only way to read back what the loop renders without item accessors.
5. Does the JSR manifest for a package with a `src/` directory need to list the source explicitly
   (currently `libs/loop2/jsr.json` includes `src/Loop2.js`)? `libs/url-util` ships a single file, so
   there is no precedent in the repository.
