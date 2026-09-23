# Implementation status — `plan/improvement-plan.md`

**Status date:** 2026-09-22 (same session as the plan)
**Gate:** `bun run check` — see `README.dev.md` for what it runs.

**Final gate result:** `bun run scripts/verify.js` → all 7 steps PASS, **136 tests across 11
packages** (jsx6 58, signal 30, eslint-plugin 13, virtual-scroll 10, popover 6, url-util 5,
signal-clock 4, w 4, jsx-dev-runtime 3, signal-dom 2, repl 1), zero TypeScript diagnostics across all
12 libs, ESLint clean, manifest audit clean.

Timing: **~26 s** on an idle machine. It is dominated by the manifest audit (17 `npm pack --dry-run`
invocations, ~12 s) and 24 `tsc` runs (~12 s); under load / with a cold disk cache the same gate has
been observed at ~90 s, so treat 26 s as the warm figure rather than a guarantee.

This document records what was implemented, what changed relative to the plan's assumptions, and
what is deliberately left open. The plan itself (§0 decisions) is unchanged and still binding.

---

## 1. The gate (§2) — done

`scripts/verify.js` is the single local gate (no CI, decision D1). One command, ~25 s cold on this
machine, non-zero exit on any failure.

| Step | Implementation |
|---|---|
| tests | `bun test` in every package that has tests, discovered by glob (9 packages today) |
| declaration emit | `tsc -p tsconfig.json` per lib — **runs before the type check** so dependents are checked against freshly emitted `dist/*.d.ts` |
| type check | `tsc --noEmit` per lib with `checkJs: true` |
| build (optional) | `--build` runs each lib's `build`/`build-cjs`, which also makes the tarball audit strict |
| lint | ESLint, executed through Bun (see §5 below) |
| versions | `scripts/check-versions.js` (repaired, P1-4) |
| docs sync | `scripts/check-docs.js` — committed `docs/demistify/` matches a build from `apps/repl/static/` |
| manifests | `scripts/check-manifests.js` — new, §2.3 |
| browser smoke | `libs/jsx6/src/browser.test.js` — new, §2.4 (part of the test step) |

Flags: `--quick`, `--tests-only`, `--build`, `--require-built`, `--no-tests`, `--no-types`,
`--no-declarations`, `--no-lint`, `--no-versions`, `--no-docs`, `--no-manifests`, `--no-pack`.

`scripts/publish.js` now runs the gate with `--require-built` in Phase 1b (after building each
package) and aborts publishing on failure (P1-5).

### §2.3 manifest audit — what it catches

For every non-private package: declared paths exist or are produced by a build script; they are
covered by `files`; every bare import resolves to a runtime dependency; the version matches
`MODULE_VERSIONING.md` and `jsr.json`; the dry-run tarball actually contains the entry points and
ships no `*.test.js`. It reproduced P1-1/2/3/7/9 exactly, plus four *additional* shipping defects
(`@jsx6/signal`, `@jsx6/w`, `@jsx6/repl` and `eslint-plugin-jsx6` all shipped test files) and the
`minimatch`-in-devDependencies bug (P1-6).

### §2.4 browser smoke test — why it is shaped that way

happy-dom implements WebIDL methods as plain functions, so a detached
`window.requestAnimationFrame` call passes every other test and throws `Illegal invocation` in real
browsers. `browser.test.js` installs a strict `window` guard (`this !== window` ⇒ throw) before the
modules under test are imported, then asserts batching works through it, that a `Loop` mounts /
reorders / removes with correct DOM order and no console errors, and that `remove()` of a parentless
node logs exactly one short line.

This test has teeth: with the pre-fix `anim = window.requestAnimationFrame`,
`runInBatch` fails with the exact `Illegal invocation` error, in both isolated and full-suite runs.

---

## 2. P0 — code paths that could not execute (done)

| ID | Fix | Regression test |
|---|---|---|
| P0-1 | `jsx2dom.js` imports and throws `JSX6E8_REQUIRE_PARENT` (was the undefined `ERR_REQUIRE_PARENT`); `UNUSED` marker dropped | `jsx2dom.test.js` |
| P0-2 | `Jsx6.js` imports `mergeValue` from `@jsx6/signal` | `Jsx6.test.js` (new) |
| P0-3 | `Loop#moveItem` uses `toDomNode` (was `todomNode`) and drops the self-assigning `var elBefore = (elBefore = …)` | `Loop.test.js` |
| P0-4 | `Loop#splice` removal path no longer references the never-assigned `this.itemNextSibling`; it detaches only, which removes two wasted DOM mutations per removed item | `Loop.test.js` + `browser.test.js` |
| P0-5 | `remove.js`: `parent` moved out of the `try` block (it resolved to `window.parent`), and the log is a single short string | `browser.test.js` |
| P0-6 | `HiddenInput` rewritten with `h('input', …)` — the published ESM entry is raw source, so shipping JSX there forced consumers to JSX-transform `node_modules` | `Jsx6.test.js` / existing tests |
| P0-7 | `splitArrayGen.js` deleted. **Plan correction:** it was *not* re-exported by `index.js` (grep found no reference at all), so deletion was clean rather than requiring an `index.js` line removal | grep |
| P0-8 | `@jsx6/scloop` **deprecated**: `"private": true`, README explains it is a retired stub, removed from `MODULE_VERSIONING.md`, stale `esm/cjs/dist` deleted. `@jsx6/virtual-scroll` already covers the feature it was reserved for | manifest audit skips private packages |

**Enabling step:** `checkJs: true` (plus `module`/`moduleResolution`/`lib`) is now set in every lib
tsconfig, and the test files are excluded where they live in `src/`.

### Deviations worth knowing

- **P0-4** was implemented by *detaching only* rather than by capturing an `itemNextSibling`. The
  parameter is used from a `splice` removal where the node must end up hidden and reusable; the
  capture-based fix in the plan would have preserved the wasted insert. Documented in a code comment.
- `Loop#moveItem(fromIndex, insertBefore)` semantics are pinned by test: `insertBefore` refers to the
  index in the **original** order (`moveItem(0, 2)` on `[1,2,3]` yields `[2,1,3]`). The plan's
  phrasing ("move … past the last one") expected `[2,3,1]`; the implementation and the parameter name
  agree on the former, so the test documents the existing contract instead of changing it.

---

## 3. P1 — published packages vs. their manifests (done)

- P1-1 `@jsx6/jsx6`: `files` now includes `dist`/`esm` and excludes `!src/**/*.test.js`.
- P1-2 `@jsx6/nodditor`: phantom `exports.require`/`unpkg` (`cjs/`) removed, `tsc` script added. The
  package's real artifact is the bundled app in `build/`, so a library CJS bundle was not invented.
- P1-3 `@jsx6/repl`: phantom `main` removed; decision recorded — it stays published as part of the
  lockstep group because it is the engine behind the *demistify* tutorial (note added to
  `MODULE_VERSIONING.md`).
- P1-4 `check-versions.js` reads the singular `catalog` (was `catalogs.default`), so the gate is no
  longer vacuous; prompt-restating comments deleted.
- P1-5 `publish.js`: gate in Phase 1b, `node_modules` copies skipped in version discovery, and
  manifest rewrites are snapshotted/restored from `process.on('exit')` + signal handlers.
- P1-6 `minimatch` moved to `dependencies` in `tools/build`.
- P1-7 `@jsx6/virtual-scroll`: `tsc` script added and `happy-dom` moved to `catalog:` (its tests were
  failing only because its dependencies had never been installed — they now pass, 10/10).
- P1-8 `versions.js` also rewrites `jsr.json`.
- P1-9 `MODULE_VERSIONING.md` lists `@jsx6/virtual-scroll` and `eslint-plugin-jsx6`; `@jsx6/scloop`
  dropped (private).
- P1-10 catalog hygiene: `@types/node` pinned to `^20.19.9`; TypeScript aligned on one range
  (root `dependencies.typescript` moved to `devDependencies: catalog:`).
- P1-11 `bun.lock` is committed; all 6 stale `package-lock.json`/`pnpm-lock.yaml` files deleted.

**Also fixed (found by the audit, not listed in the plan):** `@jsx6/editor-monaco` declared
`main`/`module`/`unpkg` pointing at `index.js`, `esm/` and `cjs/` which do not exist and are not in
`files`; they now point at the `dist/` outputs that the build actually produces.

---

## 4. P2 — lifecycle and correctness

- **P2-1 disposal — implemented in three stages** (`plan/disposal-design.md`): unsubscribers are
  collected per node behind `Symbol.for('jsx6_dispose')`, `disposeNode(el)` walks a subtree and is
  idempotent, `remove()`/`replace()`/`Loop` teardown release them, and `Jsx6` gained an
  `ondestroy()` hook. Loop items that are merely hidden stay reusable; `Loop.dispose()` releases
  everything including hidden items. 11 new tests in `libs/jsx6/src/dispose.test.js`.
- **P2-3 detached `window.requestAnimationFrame`** — bound to the window in
  `libs/signal-dom/index.js` (the batching implementation; jsx6 re-exports it — see P3-1 below), and
  the §2.4 smoke test fails without the binding. signal-dom's copy had the same bug and it was only
  found when the two copies were unified.
- **P2-5 smaller items:**
  - `signal.js`: subscription validation is now `typeof u != 'function'` (was `!u && …`).
  - `core.js`: `isNullish` matches `null` as well as `undefined`.
  - `validate.js`: a missing `pattern` no longer skips `min`/`max`.
  - `url-util`: the location is parsed lazily, `refreshUrl()`/`setUrl()` added, import no longer
    throws outside a browser and no longer goes permanently stale after SPA navigation.
  - `signal-clock`: the animation-frame loop is stoppable (`stopClock()`), and `toMs` always returns
    a number.
  - `jsx-dev-runtime`: the import-time global side effect is gone (explicit activation only).
  - `popover`: the `e.target || e` bug for elements with their own `target` attribute is fixed.
- **P2-2 keyed `Loop`** — see §7 below: implemented by a follow-up agent as this document was
  written; the design note is `plan/keyed-loop-design.md`.
- **P2-4 derived signals** — unchanged, as the plan allows (eager + fine-grained is a deliberate
  contract); the disposer work means derived subscriptions can now be released through P2-1.

---

## 5. P3 / P4 — duplication, dead weight, docs

Done: lint is real again (P4-3: ESLint 8 installed, `.eslintignore` added, JSX parsing enabled,
`globals` for `bun test`, plugin's own RuleTester suite wired into the gate); root `npm test` covers
all packages via discovery (P4-4); README/README.dev rewritten around Bun and the no-CI gate (P4-5);
`.gitattributes` replaced (P4-6); `.prettierignore` synced with `.gitignore` (P4-7); LICENSE template
brackets filled (P4-8); 15 `.rush/temp` directories deleted, Rush sections dropped from the ignore
files (P3-4); root `cli.js`, `libs/jsx6/jsx6.build.log` and `apps/repl/dist/` (59 MB stale Vite
artifact) deleted (P3-3); debug `console.log`s removed from tests (P3-5); `libs/w/happydom.fix.js`
dead scaffolding deleted; the REPL sandbox decision is documented in `README.dev.md` and `substr`
replaced with `slice` (P4-12, partly).

**P4-1 + P4-2 done:** `docs/demistify/` is regenerated from `apps/repl/static/` by the new
`scripts/build-docs.js` (`bun run docs:build`), driven by the same `esbDef` the repl build uses, and
validated before it replaces the committed site (asset references resolve, bundle parses, no orphan
assets). Result: 655,254 B → 225,651 B across 11 → 6 files, deterministic (two consecutive builds are
byte-identical), with the missing `/vite.svg` fixed via a generated `./favicon.svg` and the monaco
CDN pin corrected from the stale `0.34.100` to the `0.48.0` this repo actually builds.
`scripts/check-docs.js` is wired into the gate and fails when the committed copy drifts from
`apps/repl/static/`; `--build` adds a full rebuild-and-byte-compare.

**P4-9 done:** `docs/api.md` indexes every package's public surface (derived from `index.js` and the
emitted `.d.ts`).

**P4-11 done:** `apps/repl/src_build/build.js` now recopies the vendored Monaco/Babel assets when the
recorded package versions change (a `.vendor-versions.json` stamp, plus `--force-vendor`) instead of
only when the target directory is missing, warns when a dev build embeds the developer's absolute
source path, and no longer logs `liveServer`. `require.js` uses `slice` instead of `substr`.

**§2.5 hook added:** `.githooks/pre-commit` runs `--quick`; enable with
`git config core.hooksPath .githooks`. It is local and opt-in — not CI.

**P3-1 done — `@jsx6/signal-dom` is the single home** for the shared signal→DOM helpers, which is
what that package is for (it already depends on `@jsx6/signal`). `libs/jsx6/src/makeState.js` and
`libs/jsx6/src/setAttribute.js` are now thin re-exports of `@jsx6/signal-dom`, and
`@jsx6/jsx6` gained `@jsx6/signal-dom` as a `workspace:*` dependency (both are in the same lockstep
publish group, so they always ship together). Unifying the two copies also fixed two bugs in
signal-dom's copy and preserved one behaviour that only jsx6's copy had:

- signal-dom's `anim` was **not bound to the window** — the same detached-`requestAnimationFrame`
  bug as P2-3, still present there;
- signal-dom's `setAttribute` did **not accept component/object wrappers** (`.el`), which jsx6 callers
  and users rely on — that support moved into signal-dom rather than being lost;
- the two packages previously kept **separate batch queues**, so `setAnimFunction` on one had no
  effect on the other; there is now one queue.

The re-exports are **named**, not `export *`: signal-dom also exports `setAttribute`, and a second
star-export of that name would make it ambiguous and silently drop it from `@jsx6/jsx6`'s entry
point. Four new tests in `libs/jsx6/src/setAttribute.test.js` cover the re-exported surface through
jsx6's own entry (including the wrapper form and the `JSX6E7` error for a non-function callback).
Follow-up for the next major: delete the two shim files and import `@jsx6/signal-dom` directly.

**Lint scope decision:** the gate lints `libs/`, `tools/` and `scripts/` only. Linting `apps/` today
yields ~40 errors that are false positives (JSX-consumed components look unused to
`no-unused-vars`) plus intentional irregular whitespace inside tutorial example text. Fixing that
needs a JSX-aware `no-unused-vars` override (or `react/jsx-uses-vars`-style handling) and a decision
about the tutorial content, so it is listed as remaining rather than guessed at.

Open: **P3-2** (deprecation markers are documented, removal is a next-major job),
**P4-10 is done** (`.history` deleted — see below), the **`apps/` lint scope** decision above, and
the asynchronous REPL loader (`require()` is still a synchronous XHR because making it async changes
the REPL's public contract). `libs/w`'s `JsxW` also still lacks the P2-1 `ondestroy()` hook and its
`Loop` does not yet do keyed reconciliation — both noted as follow-ups in `plan/disposal-design.md`
and `plan/keyed-loop-design.md` (adding the hook needs a decision about re-connected custom
elements, and libs/w's Loop would need the same treatment).

### `.history/` deleted (P4-10)

The plan asked for the local `.history/` directory to be deleted and VS Code Local History to be
disabled for the workspace. Both are done: the VS Code setting is off in `.vscode/settings.json`,
every gate script ignores `.history`, and the directory itself (4,455 files / 28.4 MB) was removed
after the gate went green. It is gitignored, so it was never part of the repository; the plan's
rationale was that it slowed every glob/grep/lint/format run.

If you want that safety net back, re-enable `workbench.localHistory.enabled` in VS Code — the
directory is recreated automatically.

---

## 6. Things found while implementing (not in the plan)

1. **`libs/signal-dom/index.js` called an undefined `runFunc`** in its batch flush. Every
   `runDirty()` threw `ReferenceError` and **no queued callback ever ran**; the published `esm/`/`cjs/`
   bundles carry the same bug. The file is a copy of `makeState.js` that lost one of its two
   imports when it inlined the other. Fixed with a local helper + regression test
   (`libs/signal-dom/index.test.js`). The checked-in bundles need `bun run build && bun run build-cjs`
   at release time.
2. **Bun's isolated linker breaks Node-based `.bin` shims**: `bun x eslint` fails with
   `Cannot find module '@eslint/eslintrc'` because Node cannot resolve eslint's own dependencies from
   `node_modules/.bun/<pkg>/…`. Fixed by committing a `bunfig.toml` with `[install] linker = "hoisted"`
   **and** having the gate run ESLint through Bun (`bun node_modules/eslint/bin/eslint.js`), so it
   works under either layout.
3. **`tools/build` was invisible to a naive "skip generated dirs" filter** because the package itself
   is named `build`. Both `verify.js` and `check-manifests.js` now filter on the path *inside* the
   package dir.
4. **The plan's "≈25 remaining type diagnostics" estimate was low**: enabling `checkJs` produced
   ~150 diagnostics across 9 libs. All are now zero. The bulk were JSDoc inaccuracies (arity, unions,
   `Node` vs `Element`); `tsc` was configured with `moduleResolution: "bundler"` + `lib: esnext, dom`
   per lib (the plan's own appendix used those flags). Only one file,
   `libs/jsx6/src/Jsx6old.js` (legacy, slated for removal), carries a file-level `@ts-nocheck`.
5. **Popover had a latent crash** when an element with its own `target` attribute was passed directly.
6. **The plan's D2 baseline was not actually green in a clean checkout**: `libs/virtual-scroll` had no
   `node_modules` at all, so two of its tests failed. It passes now that its dependencies are installed
   and pinned to the catalog.
7. **`libs/w`'s `Loop` had three of the same defects the plan lists for `libs/jsx6`'s copy** — and the
   plan calls `@jsx6/w`'s Loop the canonical one, so they were fixed there too:
   - `connected` and `lastValue` were read but **assigned nowhere**, so `getValue()` could only ever
     return `[]`; they are now set in `connectedCallback`/`disconnectedCallback`/`setValue`.
   - `_remove` and `_fixItemList` treated component objects as if they were elements, so **removing an
     item never detached it** (`item.parentNode` is undefined on a component) — detach was a silent
     no-op. Both now resolve the node with `toDomNode`, matching jsx6's canonical Loop.
   - the same self-assigning ternary as P0-3 in `moveItem`, and the same insert-then-remove waste in
     `splice` as P0-4.
   Four tests now cover `libs/w`'s Loop (was two).
8. **`libs/w/happydom.fix.js` was dead debug scaffolding** (369 lines, a `console.log` inside its
   property-copy loop) referenced by nothing — `libs/w/bunfig.toml` preloads `happydom.js`, a
   different file. Deleted.

---

## 7. P2-2 keyed `Loop`

Implemented in `libs/jsx6/src/Loop.js` with a design note at
[`plan/keyed-loop-design.md`](./keyed-loop-design.md) and new cases in
`libs/jsx6/src/Loop.test.js`. See that note for the key contract, the reconciliation algorithm
(match by key, fall back to index, move rather than rebuild) and its interaction with the P2-1 reuse
pool and disposal.