# JSX6 Improvement Plan

**Created:** 2026-09-22
**Scope:** whole monorepo (`libs/*`, `apps/*`, `tools/*`, `scripts/*`, `docs/*`, repo root)
**Source:** full local analysis of the working tree + inspection of the published npm tarballs (`@jsx6/jsx6@1.8.18`, `@jsx6/nodditor@1.0.40`, `@jsx6/repl@1.8.18`) via the unpkg `?meta` API.

---

## 0. Decision record — READ THIS FIRST

These are binding project decisions, not open questions. Any future analysis, review, or
refactor proposal **must respect them and must not re-propose them**.

### D1 — No CI/CD. This project will not use continuous integration.

There is deliberately **no `.github/workflows/`, no GitLab CI, no build server, and no
automated remote gate of any kind**, and none will be added.

Consequences that follow from this decision (already accounted for in this plan):

- Recommendations of the form *"add a CI job that runs tests/lint/types"* are **out of scope
  and should not be repeated**. They were considered and rejected.
- Every quality gate described in this document is a **local** gate: a command a developer
  runs on their own machine before committing or publishing.
- Because nothing enforces checks remotely, the local harness in §2 must be **one command**,
  **fast**, and **the documented precondition for `bun pub`**. A gate nobody can run in one
  step is a gate that will be skipped.
- Publishing stays manual and local (`scripts/publish.js`), so that script must itself refuse
  to publish when local checks fail (§3, P1-5). Safety has to live in the publish path,
  because there is no pipeline behind it.

### D2 — The project is tested and verified locally.

Verification is performed on the developer machine, and at the time of writing the local
state is green. Recorded results (reproduced during the analysis that produced this plan):

| Check | Command (run from repo root unless noted) | Result |
|---|---|---|
| `@jsx6/jsx6` unit tests | `cd libs/jsx6 && bun test` | **15 pass / 0 fail**, 49 assertions, 6 files |
| `@jsx6/signal` unit tests | `cd libs/signal && bun test` | **30 pass / 0 fail**, 135 assertions, 7 files |
| `@jsx6/w` unit tests | `cd libs/w && bun test` | **2 pass / 0 fail**, 8 assertions |
| Declaration emit / type check | `cd libs/jsx6 && bun x tsc --noEmit -p tsconfig.json` | **exit 0**, clean |

Known gaps in that green state — the suites above do **not** cover `libs/w` from the root
command, `dom-observer`, `popover`, `url-util`, `virtual-scroll`, or the ESLint rule, and they
cannot catch browser-only failures under happy-dom (see P2-3). §2 closes these gaps locally.

### D3 — Toolchain decisions already made

- **Bun** is the workspace/install/test runner (`workspaces` + `catalog:` in the root
  [package.json](../package.json)). Rush is gone; `rush.json` and `common/` no longer exist.
- **esbuild** builds bundles; **`tsc`** only emits `.d.ts` (source stays JS + JSDoc, no TS
  source files).
- **npm** performs the actual `publish` (invoked by `scripts/publish.js`).
- Docs must be updated to match: [README.md:48](../README.md#L48) still says `rush update`.

---

## 1. Current state snapshot

17 packages, ≈7k lines of first-party JS/JSX, no TypeScript source.

| Layer | Package | Notes |
|---|---|---|
| Reactivity core | `@jsx6/signal` | Strongest code in the repo; batching, unsubscribe, observable/promise interop, 30 tests |
| DOM/JSX | `@jsx6/jsx6` | 35 re-exported modules; `toDom`/`insertAttr`/`Loop`/directives/forms/validation/i18n |
| JSX runtimes | `@jsx6/jsx-runtime`, `@jsx6/jsx-dev-runtime` | `jsx`/`jsxs`/`Fragment`; dev adds `_source` + click-to-editor inspector |
| Components | `@jsx6/w` | Real custom elements (`JsxW`, `JsxWS`, `define()`, `jsx6-loop`) |
| Utilities | `dom-observer`, `signal-dom`, `signal-clock`, `popover`, `virtual-scroll`, `url-util`, `editor-monaco` | Mixed maturity; `scloop` is an empty stub |
| Apps | `apps/repl`, `apps/nodditor` | REPL powers the *demistify* tutorial; nodditor is a blocky node editor |
| Tooling | `tools/build`, `tools/eslint-plugin-jsx6` | esbuild/copy/watch helpers; custom `$S`/`$F` dependency lint rule |

**Strengths to preserve:** fine-grained signal→DOM updates with no virtual DOM; one-runtime-dep
core; symbol-based duck typing so promises/observables interop; error-code indirection that keeps
message strings out of production bundles; a genuinely useful custom lint rule for manual
dependency tracking.

---

## 2. The local verification harness (this is the CI replacement)

Because of D1, all gating collapses into one local command. Target: **under ~60 s cold,
one command, non-zero exit on any failure.**

### 2.1 Deliverable

Add `scripts/verify.js` (Bun) and a root script:

```jsonc
// package.json
{
  "scripts": {
    "check": "bun run scripts/verify.js",        // the local gate
    "check:fast": "bun run scripts/verify.js --quick"  // tests + checkJs only
  }
}
```

### 2.2 What `bun run check` must run, in order

| Step | What | Why it is in the local gate |
|---|---|---|
| 1 | `bun test` in **every** package that has `*.test.js` (discovered by glob, skipping `node_modules`) | Root `npm test` currently covers only 3 of 17 packages |
| 2 | `tsc --checkJs --noEmit` per lib, using each package's `tsconfig.json` + `checkJs` | Catches the undefined-identifier class of bug (P0-1…P0-3) automatically |
| 3 | `tsc -p tsconfig.json` declaration emit per lib | Keeps `dist/*.d.ts` producible before publish |
| 4 | `eslint` with `.eslintrc.cjs` (includes the `jsx6/signal-dependencies` rule) | The custom rule is the only defense against missing `$S`/`$F` deps |
| 5 | `bun run scripts/check-versions.js` | Must be repaired first (P1-4) or it stays vacuous |
| 6 | **Package manifest audit** (new, see 2.3) | Catches the `files`/`exports`/`types` mismatches that already shipped broken tarballs |
| 7 | **Browser-only smoke check** (new, see 2.4) | happy-dom hides `Illegal invocation`-class bugs |

`--quick` runs steps 1–2 only.

### 2.3 New check: manifest audit (replaces "CI would have caught this")

For every non-private package, assert locally:

1. every path in `exports` / `main` / `module` / `unpkg` / `types` either exists on disk **or**
   is produced by that package's `build`/`build-cjs`/`tsc` script;
2. every directory those paths live in is listed in `files` (this is exactly the bug that shipped
   `@jsx6/jsx6` without `dist/` and `@jsx6/nodditor` without `cjs/`);
3. every bare import in `index.js` + `src/**` resolves to a runtime `dependencies` entry
   (catches the `minimatch`-in-devDependencies bug in `tools/build`);
4. `version` agrees with `MODULE_VERSIONING.md` and, where present, `jsr.json`;
5. **dry-run tarball listing** — run `npm pack --dry-run --json` and assert the entry points and
   `dist/` are inside the tarball. This is the single highest-value check in the whole plan: it is
   the only one that would have caught all three published-package breakages before they shipped.

### 2.4 New check: browser-only smoke test

happy-dom tolerates detached WebIDL methods, so `anim = window.requestAnimationFrame` followed by
`anim(cb)` passes tests and throws `Illegal invocation` in Chrome/Firefox/Safari. Add a tiny
Playwright-free smoke page (or a `@happy-dom` run with a strict `window` proxy) that at minimum:

- calls `runInBatch()` from `makeState.js` / `signal-dom` and asserts the callback fires;
- mounts one `Loop`, reorders it, removes items, and asserts DOM order + no console errors;
- asserts `remove()` of a parentless node logs **one** line, not the whole `window` object.

### 2.5 Make the gate un-skippable (locally)

- `scripts/publish.js` must run `bun run scripts/verify.js` in Phase 1 and abort on failure
  (it already has a validation phase — extend it, do not add a second entry point).
- Optional: a `pre-commit` git hook that runs `--quick`. This is a **local** hook, not CI, and is
  consistent with D1.
- Document the gate at the top of [README.dev.md](../README.dev.md): *"`bun run check` must pass
  before `bun pub`. There is no CI; this command is the only gate."*

---

## 3. Work items

Priority reflects user-visible breakage first, then publish correctness, then architecture.
Every item lists **evidence**, **fix**, and the **local** command that proves it fixed.

### P0 — Code paths that cannot execute

These are not theoretical; each was reproduced during the analysis.

| ID | Location | Defect | Fix | Local verification |
|---|---|---|---|---|
| P0-1 | [jsx2dom.js:291](../libs/jsx6/src/jsx2dom.js#L291) | `throwErr(ERR_REQUIRE_PARENT, …)` — identifier never imported. `insert(undefined,'x')` → `ReferenceError`. [errorCodes.js:29](../libs/jsx6/src/errorCodes.js#L29) marks `JSX6E8_REQUIRE_PARENT` as `// - UNUSED` | Import `JSX6E8_REQUIRE_PARENT` and use it; drop the `UNUSED` marker | new test in `jsx2dom.test.js`; `bun x tsc --checkJs` clean |
| P0-2 | [Jsx6.js:32-34](../libs/jsx6/src/Jsx6.js#L32-L34) | `mergeValue(v) { mergeValue(this.$v, v) }` — never imported ⇒ every call throws `ReferenceError`. The `@jsx6/w` sibling [JsxW.js:2](../libs/w/src/JsxW.js#L2) imports it correctly (copy/paste regression) | Add `mergeValue` to the `@jsx6/signal` import | new `Jsx6.test.js` case |
| P0-3 | [Loop.js:153](../libs/jsx6/src/Loop.js#L153) | `todomNode(...)` (lowercase `d`) ⇒ `Loop#moveItem()` always throws. tsc: *"Did you mean 'toDomNode'?"* | Rename to `toDomNode`; also fix the self-assigning `var elBefore = … (elBefore = …)` on the same line | new `Loop.test.js` case for `moveItem` |
| P0-4 | [Loop.js:197](../libs/jsx6/src/Loop.js#L197) | `this.itemNextSibling` is assigned **nowhere** in the repo ⇒ every `splice`-removal appends the node to the parent's end and then detaches it (2 wasted mutations, wrong position) | Capture the loop's `nextSibling` (or the anchor text node) once and use it as the `before` reference | extend `Loop.test.js`: remove-from-middle asserts sibling order |
| P0-5 | [remove.js:9](../libs/jsx6/src/remove.js#L9) | `catch` references `parent`, which is block-scoped in `try` ⇒ resolves to global `window.parent`, dumping the entire window/document graph to `console.error` before rethrowing | Move `const parent` above `try`, or log `_child` only | reproduce with a parentless node; assert single-line log |
| P0-6 | [HiddenInput.js:7](../libs/jsx6/src/HiddenInput.js#L7) | Raw JSX shipped on the published **ESM** path (`exports.default → ./index.js → src/**`) ⇒ `import '@jsx6/jsx6'` fails with `Cannot find module 'react/jsx-dev-runtime'` unless the consumer's bundler JSX-transforms `node_modules` | Either (a) point `exports.default` at the prebuilt `esm/` bundle, or (b) rewrite `HiddenInput` without JSX (`h('input', …)`), or (c) document the loader requirement loudly in the README. (a) or (b) preferred | `node -e "import('@jsx6/jsx6')"` in a clean dir with the packed tarball |
| P0-7 | [splitArrayGen.js](../libs/jsx6/src/splitArrayGen.js) | 130 lines, **zero `export` statements**, yet re-exported by [index.js](../libs/jsx6/index.js) | Delete the file and its `index.js` line, **or** export the four helpers and add tests. Also fix the `offset > inp.length` off-by-one at [:105](../libs/jsx6/src/splitArrayGen.js#L105) | grep: no `splitArrayGen` reference left, or new tests pass |
| P0-8 | [scloop/index.js](../libs/scloop/index.js) | One `import`, no exports, published as `@jsx6/scloop@1.0.0` ⇒ empty package on npm | Implement it or deprecate/unpublish; remove from `MODULE_VERSIONING.md` if dropped | `node -e "console.log(Object.keys(require('@jsx6/scloop')))"` non-empty |

**Enabling step for all of P0:** turn on `"checkJs": true` in each lib's `tsconfig.json`.
[typescript.notes.md](../typescript.notes.md) already prescribes it; no package actually sets it.
Running `tsc --checkJs` over six `libs/jsx6` files produced **28 errors**, including P0-1, P0-2,
P0-3 verbatim. Expect to triage ~25 remaining diagnostics (mostly JSDoc arity/typing noise such as
`mapProp` callback arity and `delayFunc(doChunk, sleep)`); they can be suppressed per-line rather
than blocking the switch.

### P1 — Published packages don't match their own manifests

All verified against the live registry, so these are shipping defects, not predictions.

| ID | Package | Declared | Actually in the tarball | Fix |
|---|---|---|---|---|
| P1-1 | `@jsx6/jsx6@1.8.18` | `types: dist/index.d.ts`, `exports["."].types` | **no `dist/`** — [files](../libs/jsx6/package.json#L18-L22) is `["index.js","src","cjs"]`. Tarball instead ships `src/*.test.js` and a 108 KB sourcemap | Add `dist` to `files`; exclude `*.test.js`; consider dropping the CJS map |
| P1-2 | `@jsx6/nodditor@1.0.40` | `exports.require: ./cjs/index.js`, `unpkg: cjs/index.js` | **no `cjs/`** ⇒ `require()` and the unpkg URL 404 | Add a `build-cjs` script (as `libs/jsx6` has) or drop the `require`/`unpkg` entries |
| P1-3 | `@jsx6/repl@1.8.18` | `main: index.js` | **no `index.js`** (only `esm/`, `cjs/`); also an *app* sitting in the lockstep **publish** group | Remove the phantom `main`, or add the file; decide whether `@jsx6/repl` should be published at all — if not, set `"private": true` and drop it from `scripts/versions.json` |
| P1-4 | `scripts/check-versions.js` | reads `rootPkg.catalogs.default` ([:5-7](../scripts/check-versions.js#L5-L7)) | root uses Bun's singular **`catalog`** ⇒ `catalogDeps` always empty ⇒ the gate always prints *"All dependencies are correctly managed"* (confirmed by running it) | Read `rootPkg.catalog`; delete the leftover prompt-restating comments at [:41-51](../scripts/check-versions.js#L41-L51) |
| P1-5 | `scripts/publish.js` | — | No manifest/tarball verification; rewrites `package.json` on disk ([:208](../scripts/publish.js#L208)) and restores it in `finally` ([:243](../scripts/publish.js#L243)) ⇒ an interrupted publish leaves the repo with resolved versions and no `workspace:*`/`catalog:` markers | Run `bun run check` in Phase 1; add `npm pack --dry-run --json` assertion (§2.3 step 5); write the resolved manifest to a temp copy and publish with `--manifest`-style isolation, or snapshot+restore with a `process.on('exit')` guard |
| P1-6 | `@jsx6/build@0.2.4` | imports `minimatch` at [checkMatch.js:1](../tools/build/src/checkMatch.js#L1) | `minimatch` is in **devDependencies** ⇒ broken for consumers | Move to `dependencies` |
| P1-7 | `@jsx6/virtual-scroll@1.0.0` | `types: dist/index.d.ts`, `files: dist` | `dist/` does not exist locally; package is **not on npm** (404) ⇒ first publish will repeat P1-1 | Build `dist` before publish; the §2.3 audit makes this automatic |
| P1-8 | [libs/url-util/jsr.json](../libs/url-util/jsr.json) | duplicates `version: 1.0.1` | `scripts/versions.js` only rewrites `package.json` + `MODULE_VERSIONING.md` ⇒ JSR version will drift | Extend `versions.js` to update `jsr.json`, or read the version from `package.json` at publish time |
| P1-9 | [MODULE_VERSIONING.md](../MODULE_VERSIONING.md) | standalone list | omits `@jsx6/virtual-scroll` and `eslint-plugin-jsx6` | Add both (or mark them private) |
| P1-10 | Catalog hygiene | `@types/node: "latest"` (unpinned); root `dependencies.typescript ^5.9.3` vs catalog `^5.0.4` | Non-reproducible installs; two TS versions in play | Pin `@types/node`; align TypeScript on one range |
| P1-11 | **No lockfile at all** (`bun.lock` removed in `837cd61`) while 6 stale per-package `package-lock.json`/`pnpm-lock.yaml` remain | Installs are not reproducible, and the stale lockfiles mislead readers about which tool is authoritative | Commit `bun.lock`; delete `libs/jsx6/package-lock.json`, `libs/signal/pnpm-lock.yaml`, `libs/signal-clock/pnpm-lock.yaml`, `apps/repl/pnpm-lock.yaml`, `apps/nodditor/package-lock.json`, `tools/build/{package-lock.json,pnpm-lock.yaml}` |

**Local verification for all of P1:** `bun run check` (with §2.3 implemented) plus, for the already
published packages, `npm view @jsx6/jsx6@1.8.18 dist.tarball` + `npm pack --dry-run` comparison.

### P2 — Lifecycle: the core architectural gap

| ID | Problem | Evidence | Plan |
|---|---|---|---|
| P2-1 | **No teardown anywhere in `@jsx6/jsx6`.** Every `observeNow()` unsubscribe function is discarded: [jsx2dom.js:243](../libs/jsx6/src/jsx2dom.js#L243), [directives.js:16-42](../libs/jsx6/src/directives.js#L16-L42), [Loop.js:29](../libs/jsx6/src/Loop.js#L29). Grep for `unsubscribe\|destroy\|dispose\|cleanup` across `libs/jsx6` returns only two `removeEventListener` calls in `fireCustom.js`. Reproduced: after `el.remove()`, the signal fired **4 more updates** against the detached node — any long-lived `$State` retains every element ever bound to it | This is the single highest-impact design fix | **Stage 1 (non-breaking):** collect unsubscribers per created node — e.g. `node[jsxDisposeSymbol].push(unsub)` inside `insertAttr`/directives — and expose `disposeNode(el)` that walks a subtree and releases them. **Stage 2:** call it from `remove()`/`replace()`/`Loop` item eviction so the common paths clean up automatically. **Stage 3:** add an optional `ondestroy()` hook on `Jsx6`/`JsxW` and document it. Keep `@jsx6/signal` unchanged — it already returns proper unsubscribe functions |
| P2-2 | **`key` is inert.** [insertAttr](../libs/jsx6/src/jsx2dom.js#L219-L229) stores `loopKey`/`$key`; nothing in the repo ever reads them. `Loop` reconciles purely by index ([setItem](../libs/jsx6/src/Loop.js#L54-L62)), so reordering reuses the wrong component instances | Biggest functional gap vs Solid/React keyed lists; `libs/w`'s newer Loop has the same limitation | Add a key→item map in `Loop` used by `setValue`/`splice`: match by key first, fall back to index; move (not rebuild) matched nodes. Add tests for reorder, insert-at-front, and remove-from-middle. If keyed reconciliation is deliberately not wanted, **remove the `key` handling** and document index-based reuse instead — an attribute that silently does nothing is worse than no attribute |
| P2-3 | **`window.requestAnimationFrame` detached** at [makeState.js:8](../libs/jsx6/src/makeState.js#L8) and [signal-dom/index.js:7](../libs/signal-dom/index.js#L7) ⇒ `Illegal invocation` in real browsers; happy-dom tolerates it so tests can't catch it. Both copies are unused inside the repo | Dead public API, duplicated, broken in browsers | Bind it (`window.requestAnimationFrame.bind(window)`) or call through `window`; delete one of the two copies (§P3-1); cover with the §2.4 browser smoke check |
| P2-4 | **Derived signals are eager, glitchy and leaky.** [createDerivedSignal](../libs/signal/index.js#L16-L21) subscribes to each listed dep and recomputes on *every* dep change: no laziness, no topological ordering (multi-source updates expose intermediate values), and subscriptions are never released | Documented behaviour of `$S`/`$F`; the custom lint rule exists to police the manual dep lists | Decide and document the contract (fine-grained + eager is a legitimate choice). Minimum: (a) release derived subscriptions via the P2-1 disposer, (b) note glitch behaviour in the `$S`/`$F` JSDoc, (c) keep the `jsx6/signal-dependencies` lint rule as the guard. Auto-tracking is a larger redesign — record it as an explicit non-goal unless it is wanted |
| P2-5 | Smaller correctness items | [signal.js:100](../libs/signal/src/signal.js#L100) `if (!u && typeof u != 'function')` should be `\|\|`; [core.js:46](../libs/jsx6/src/core.js#L46) `isNullish = o => o !== null && o === undefined`; [validate.js:87](../libs/jsx6/src/validate.js#L87) `if (!pattern) return` silently skips `min`/`max`; [url-util/index.js:17](../libs/url-util/index.js#L17) caches `new URL(location)` at import (throws outside a browser, permanently stale after SPA navigation); `signal-clock` starts an unstoppable rAF loop and uses `time instanceof Number`; [jsx-dev-runtime/index.js:33](../libs/jsx-dev-runtime/index.js#L33) runs a global side effect on import while packages declare `"sideEffects": false` | Fix each in place; each needs one test. For `url-util`, make the URL lazily read per call (or export an explicit `refresh()`), and guard `typeof location` |

### P3 — Duplication and dead weight

| ID | Item | Plan |
|---|---|---|
| P3-1 | Batching logic duplicated verbatim: [libs/jsx6/src/makeState.js](../libs/jsx6/src/makeState.js) ≡ [libs/signal-dom/index.js:1-58](../libs/signal-dom/index.js#L1-L58). `setAttribute` duplicated: [libs/jsx6/src/setAttribute.js](../libs/jsx6/src/setAttribute.js) ≡ [signal-dom](../libs/signal-dom/index.js#L84-L98). `signal2Attribute`/`signal2Text` overlap `makeAttrUpdater` | Pick one home (probably `signal-dom`) and re-export from the other for one release, then remove |
| P3-2 | **Three component models**: `Jsx6` (wrapper with `.el`), `Jsx6old` (legacy `tagName`), `JsxW` (custom elements). Plus two divergent `Loop`s: [libs/jsx6/src/Loop.js](../libs/jsx6/src/Loop.js) (228 lines) vs [libs/w/src/Loop.js](../libs/w/src/Loop.js) (260 lines) | Document which is canonical (evidence points to `JsxW` + `@jsx6/w`'s Loop). Mark the others `@deprecated` in JSDoc, then remove in the next major. Do not keep fixing bugs in both copies |
| P3-3 | Root [cli.js](../cli.js) is a leftover "sample script"; [libs/jsx6/jsx6.build.log](../libs/jsx6/jsx6.build.log); `apps/repl/dist/` is a stale **Vite** artifact while the build now emits to `apps/repl/build/` | Delete `cli.js` and the log; delete `apps/repl/dist/` (see P4-1 for the docs consequence) |
| P3-4 | 15 leftover `.rush/temp/` directories across every package | Delete; remove the Rush sections from `.gitignore`/`.prettierignore` once gone |
| P3-5 | Debug output in tests: [jsx2dom.test.js:41-43](../libs/jsx6/src/jsx2dom.test.js#L41-L43) prints `sssssssssssssssssss` and `CCCCCCCCCCCCCCCCCCCC 1` on every run | Remove the `console.log`s |

### P4 — Docs site, tooling and repo hygiene

| ID | Item | Evidence | Plan |
|---|---|---|---|
| P4-1 | `docs/demistify/` is a **hand-committed stale Vite build** (~660 KB JS + maps) that can no longer be produced from source | It pins `@jsx6/editor-monaco@0.34.100` from jsdelivr while the repo is at **0.48.0**; references a missing `/vite.svg`; asset hashes differ from `apps/repl/dist/` (`demistify.7cb0d7f6.js` vs `d5f842aa`) | Rebuild the tutorial from `apps/repl/static/demistify.jsx.md` with the current esbuild pipeline; add a `docs:build` script that regenerates `docs/demistify/` deterministically; bump or unpin the Monaco CDN version; fix the favicon |
| P4-2 | Tutorial markdown exists in **4 copies** with no sync step | `apps/repl/static/` (source, 20,809 B) ≡ `docs/demistify/` ≡ `apps/repl/build/` ≡ `build_dev/`, but `apps/repl/dist/` has already drifted (19,650 B) | Single source of truth (`apps/repl/static/`); `docs:build` copies it; add a `verify.js` check that the committed `docs/` copy matches a fresh build |
| P4-3 | ESLint is **configured but not installed** | `.eslintrc.cjs` + `tools/eslint-plugin-jsx6` + a RuleTester suite exist, yet no package declares `eslint` and root `node_modules` holds only `typescript` ⇒ `npm run lint` cannot run | Add `eslint: catalog:` to root `devDependencies`; also add `.eslintignore`/`ignorePatterns` for `.history`, `docs/`, `build*/`, `dist/` — otherwise `eslint .` walks 4,455 history files. Wire the plugin's own test into `bun run check` |
| P4-4 | Root `npm test` covers **3 of 17 packages** | [package.json:5-7](../package.json#L5-L7) hardcodes `libs/jsx6`, `libs/signal`, `libs/signal-clock` | Replace with discovery-based `verify.js` (§2.2 step 1); keep `test` as an alias so muscle memory still works |
| P4-5 | README/toolchain drift | [README.md:48](../README.md#L48) says `rush update`; [README.dev.md](../README.dev.md) says `bun install`; README mixes `npm run build` with `bun x tsc` | Rewrite the "Development / contribution" section around Bun; **state explicitly that there is no CI and `bun run check` is the gate** (D1/D2) so contributors and future tooling don't re-introduce pipeline assumptions |
| P4-6 | `.gitattributes` is still the Rush-generated file | Labels every `*.json` as *JSON-with-Comments* on GitHub; defines no newline rules even though [.prettierrc.js:10](../.prettierrc.js#L10) claims "`.gitattributes` manages newlines" | Replace with `* text=auto eol=lf` + binary rules for `.ttf`/`.map`; drop the Rush lockfile merge drivers |
| P4-7 | `.prettierignore` claims sync with `.gitignore` ([:2](../.prettierignore#L2)) but misses `build`, `build_dev`, `coverage` | Prettier would reformat generated output | Sync the two lists, or generate one from the other |
| P4-8 | [LICENSE.md:3](../LICENSE.md#L3) has unfilled template brackets | `Copyright (c) [2015] [Davor Hrg] [hrgdavor@gmail.com]` | Fill in properly (and consider dropping the personal email from a published file) |
| P4-9 | No API reference for 35 exported modules | Only READMEs + the interactive tutorial | Generate `.d.ts`-derived API docs as part of `docs:build`, or write a short `docs/api.md` per package |
| P4-10 | `.history/` = **4,455 files / 27.1 MB** in the working tree | Gitignored, but it slows every glob/grep/lint/format run | Delete it locally and disable VS Code Local History for this workspace (`.vscode/settings.json`) |
| P4-11 | `apps/repl` build script rough edges | [build.js:20-23](../apps/repl/src_build/build.js#L20-L23) copies Monaco/Babel **only if the target dir is missing** ⇒ stale vendor assets after a dependency upgrade; [:8](../apps/repl/src_build/build.js#L8) injects the developer's absolute filesystem path into dev builds; [:36](../apps/repl/src_build/build.js#L36) `console.log('liveServer', liveServer)` leftover | Copy when the source is newer (or add `--force-vendor`); keep the path injection dev-only (it already is) but log a warning; drop the debug log |
| P4-12 | REPL sandbox provides false assurance | [FlipFrame.jsx:41](../apps/repl/src/FlipFrame.jsx#L41) uses `sandbox="allow-same-origin allow-scripts"` — the combination MDN documents as letting framed code escape — then [simpleRunner.js:16](../apps/repl/src/runner/simpleRunner.js#L16) `eval`s user code and [require.js:18](../apps/repl/src/runner/require.js#L18) fetches **arbitrary unpkg packages** and evals them over a **synchronous XHR** ([:5](../apps/repl/src/runner/require.js#L5)) | Arbitrary same-origin execution is inherent to an in-browser REPL, so either (a) serve the tutorial from a dedicated origin and keep the sandbox, or (b) drop `allow-same-origin` and accept reduced capability. Document the choice. Independently: replace sync XHR with `fetch`, and `substr` with `slice` |

---

## 4. Out of scope (do not re-propose)

- **CI/CD of any kind** — see D1. No GitHub Actions, no remote gates, no automated publishing.
- **SSR / SEO support** — explicitly rejected by the project ([README.md:50-56](../README.md#L50-L56)).
- **Migration to TypeScript source** — the project is JS + JSDoc by design; `checkJs` is the
  intended level of enforcement.
- **Auto-tracking / lazy signal graph** — recorded as a possible future redesign (P2-4), not a
  committed goal.
- **A virtual-DOM or diffing layer** — contrary to the library's premise.

---

## 5. Suggested sequencing

All steps are local; each ends with `bun run check` green.

1. **Week 1 — make the gate real:** implement `scripts/verify.js` (§2.1–2.3), fix
   `check-versions.js` (P1-4), install ESLint (P4-3), commit `bun.lock` and delete the stale
   lockfiles (P1-11). Nothing else should start before the gate exists, because D1 means there is
   no second line of defense.
2. **Week 1 — P0 sweep:** enable `checkJs`, fix P0-1…P0-5 with a regression test each, triage the
   remaining ~25 type diagnostics.
3. **Week 2 — publish correctness:** P1-1, P1-2, P1-3, P1-6, P1-7, then re-publish the lockstep
   group as a patch release. Add the `npm pack --dry-run` assertion to `publish.js` (P1-5) before
   doing so.
4. **Week 3+ — architecture:** P2-1 (disposal) in three stages, then P2-2 (keyed `Loop`) — these
   two are the real functional upgrades and deserve their own design note in `plan/`.
5. **Ongoing:** P3 dedupe/dead-code, P4 docs+hygiene. P4-1/P4-2 (rebuild the tutorial site) is
   user-visible and cheap once the esbuild pipeline is trusted.

---

## 6. Appendix — commands used to produce the evidence

```bash
# unit tests (all green at time of writing)
cd libs/jsx6    && bun test          # 15 pass / 0 fail
cd libs/signal  && bun test          # 30 pass / 0 fail
cd libs/w       && bun test          #  2 pass / 0 fail

# declaration emit is clean
cd libs/jsx6 && bun x tsc --noEmit -p tsconfig.json

# the checkJs sweep that exposes P0-1/P0-2/P0-3 (28 errors over 6 files)
cd libs/jsx6 && bun x tsc --checkJs --allowJs --noEmit --target esnext \
  --moduleResolution bundler --module esnext --skipLibCheck \
  src/jsx2dom.js src/Jsx6.js src/Loop.js src/remove.js src/makeState.js src/splitArrayGen.js

# the vacuous version gate (prints "All dependencies are correctly managed." regardless)
bun run scripts/check-versions.js

# published-tarball inspection (how P1-1/P1-2/P1-3 were confirmed)
#   https://unpkg.com/@jsx6/jsx6@1.8.18/?meta      -> no dist/
#   https://unpkg.com/@jsx6/nodditor@1.0.40/?meta  -> no cjs/
#   https://unpkg.com/@jsx6/repl@1.8.18/?meta      -> no index.js
```

Runtime reproductions (happy-dom + `bun`, scratch script since deleted): `insert(undefined,'x')`
→ `ReferenceError: ERR_REQUIRE_PARENT is not defined`; `Jsx6.prototype.mergeValue.call(…)` →
`ReferenceError: mergeValue is not defined`; `remove(orphan)` → multi-KB `window` dump;
signal kept updating a detached element (4 updates after `el.remove()`); `Loop` rebuild count
unchanged across a reorder (index-based reuse, `key` ignored).
