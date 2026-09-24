# Migrating `@jsx6/signal` onto alien-signals

**Created:** 2026-09-23 (working-tree analysis session)
**Scope:** `libs/signal` (the reactivity core) plus every in-repo consumer: `libs/jsx6`, `libs/w`,
`libs/signal-dom`, `libs/signal-clock`, `apps/repl`, `apps/nodditor`, the `jsx6/signal-dependencies`
lint rule, the packaging/gate scripts, and the published-package contract.
**Target:** [`stackblitz/alien-signals`](https://github.com/stackblitz/alien-signals), npm
`alien-signals@3.2.1` (MIT, zero runtime dependencies).
**Evidence:** every alien-signals claim below was verified by running probes against the real
`alien-signals@3.2.1` package, not read from documentation. Probe scripts are reproduced in
[Appendix B](#appendix-b--probe-scripts).

> **Status (updated 2026-09-23): superseded as a standalone recommendation.**
> This document is now kept for two purposes: **(a)** it is the shared evidence base for
> alien-signals semantics, defects and packaging, and **(b)** it is the full specification of
> **Direction C** in [plan/signal-directions-portfolio.md](../plan/signal-directions-portfolio.md).
> The portfolio replaces this document's single-recommendation framing after the user clarified that
> *eager propagation is a deliberate fit for long-lived components and must be kept*, that
> *coexistence* is a valid goal in itself, and that *several directions will be implemented and
> compared*. Two consequences of that clarification are measured in the portfolio and matter here:
> the bridge/interop path and the alien-as-backend path are **not faster** than the current core
> (12.2 ms vs 11.4 ms per 200k write+read), and adding a native `computed` to the existing core
> (portfolio Direction B) reaches the user-facing goal without any dependency. Read §4 below as
> "which variant of C", not as "the plan".

---

## 0. TL;DR and the decision this plan needs

`@jsx6/signal` is not "an implementation of signals" in the abstract — it is a **specific,
load-bearing contract** that the whole JSX6 runtime is built on:

> *a signal is a plain callable function* — `$sig()` reads, `$sig(v)` writes and returns `true`
> when it changed, and any function-valued prop or child in JSX is automatically treated as one.

alien-signals happens to use the **same callable shape** (`count()`, `count(2)`, verified), which is
why this migration is feasible at all. But it is a *different* library with a different propagation
model (push-pull, lazy computed, effect queue) and a different disposal model (nested effects,
scopes). The custom module therefore cannot be deleted — it has to become an **adapter** that keeps
~15 public names and 6 load-bearing behaviours byte-compatible.

Four consequences that drive everything else:

1. **A pure "swap the storage" migration is not worth doing.** If `signal()` is re-backed by
   alien-signals but `$S`/`$F` stay eager and manually declared, the payoff is ~zero (alien's
   glitch-free/lazy graph is bypassed) while the risks (cleanup footgun, nested-effect disposal,
   CDN bare-import breakage) are all taken. **The migration only pays off if the derived signals
   move to `computed` and dependency tracking becomes automatic** — which is exactly what
   `plan/improvement-plan.md` P2-4 recorded as a *possible future redesign* and line 242 lists as
   **out of scope**.
2. **This plan therefore requires an explicit scope decision** (§12, Q1). It supersedes
   `improvement-plan.md` line 242; it does not re-propose a rejected idea, it asks for that scope
   line to be reopened.
3. **No downstream project has to change a line of code** — *if* Option A (§5) is taken and the
   adapter is faithful. That is the whole point of the adapter, and the reason the plan measures
   its cost in adapter complexity plus a short list of behavioural changes, not in consumer edits.
4. **Performance is not the argument.** alien-signals is fast and deeply proven (Vue 3.6's core,
   6.5 M weekly downloads, 180/180 conformance), but its *published* benchmarks are JIT-less
   propagation microbenchmarks, and a community report shows it losing to a plain array-based
   implementation on wide/very-dynamic graphs with higher update-time allocation
   ([#108](https://github.com/stackblitz/alien-signals/issues/108)) — which is closer to JSX6's
   workload than the benchmarks are. The real, defensible wins are **correctness/structure**
   (glitch-free lazy derived graph, auto-tracking, `trigger`, scopes). Phase 0 must measure perf
   before anyone claims it (C22, §12 Q7).

**Recommended for direction C:** Option A — publish a faithful adapter in `libs/signal`, port the
derived signals to `computed`, cover it with the existing 7 test files plus new regression tests, ship
as `1.9.0` (minor, non-breaking API) with a documented behavioural delta. **Effort: ~14–15 focused
developer days** (§7). A de-risking spike is ~1.5 days and should be done first, in `experiments/`.
**Across all directions, the portfolio's phasing applies instead: A + B + F + harness ≈ 8–9 days, and
C only if the survivors leave a real gap.**

---

## 1. What `@jsx6/signal` actually is today

### 1.1 Anatomy

| File | Lines | Role |
|---|---|---|
| [libs/signal/index.js](../libs/signal/index.js) | 147 | Public barrel: `$S`/`$F` derived signals, template-string form, filter helpers (`$NOT`, `$If`, `$Or`, `$EQ`, `$Map`, …) |
| [libs/signal/src/signal.js](../libs/signal/src/signal.js) | 125 | `prepareSignal` (the real core), `signal`, `staticSignal`, `asSignal`, `ValueSymbol`, `runFuncNoArg` |
| [libs/signal/src/observe.js](../libs/signal/src/observe.js) | 114 | `subscribeSymbol`/`triggerSymbol` protocol, `observe`/`observeNow`/`subscribe`, `triggerSignal`, `isObservable` |
| [libs/signal/src/state.js](../libs/signal/src/state.js) | 108 | `$State` proxy + `mergeValue` + `mergeValueSymbol` |
| [libs/signal/src/makeContext.js](../libs/signal/src/makeContext.js) | 44 | DOM-context WeakMaps (`makeContext`, `makeSignalContext`) |
| tests | 7 files / 30 tests | `index`, `observe`, `state`, `unsubscribe`, `asSignal`, `debug`, `makeContext` |

Total hand-written core ≈ 470 lines. **`dependencies: {}` — the package has zero runtime deps
today**, and [plan/improvement-plan.md:73](../plan/improvement-plan.md#L73) lists "one-runtime-dep
core" as a strength to preserve.

### 1.2 The load-bearing contract (what may not change)

| # | Behaviour | Where it is relied on |
|---|---|---|
| K1 | `signal` is a **plain function**: `$sig()` reads, `$sig(v)` writes, returns `true` when it changed and `undefined` when it did not | Everywhere; `$s.x++` and `$s.x = v` in app code |
| K2 | Change detection uses `===` (so `NaN` always "changes", `-0`/`0` does not) | `signal.js:78-82`; `state.test.js`, `state.js:52-53` |
| K3 | **Symbol duck-typing protocol**: `Symbol.for('signalSubscribe')` / `Symbol.for('signalTrigger')` on any object make it a signal; subscribes return an unsubscribe closure | `observe.js:73`, `jsx6/src/trans.js:28-33` |
| K4 | `observeNow(obj, cb)` calls `cb` **immediately** with the value for signals/statics, uses `.then`/`.subscribe` for promises/observables, and returns an unsubscribe function | `jsx6/src/jsx2dom.js:142,260`, `directives.js:15-47`, `signal-dom:69,78`, `Loop.js:154` |
| K5 | `subscribe(obj, cb)` calls `cb` with **zero arguments** (the "notification only" guarantee, `doc/observe.md:28-30`) | `trans.js`, `unsubscribe.test.js`, DOM updaters |
| K6 | **Any function-valued prop or child is treated as a signal** — `insertAttr` runs `observeNow(value, updater)` on any `isFunc(value)` | `jsx2dom.js:256-260` |
| K7 | **Propagation is synchronous**, so a write is visible to the next synchronous read, and errors/frames stay on the user's stack | `README.md:7`, `docs/api.md:42-45` |
| K8 | `$State` proxy: `$s.x` is a child signal, `$s.x = v` writes, `$s.x++` read-modify-writes, `$s({...})` replaces **and resets absent keys to `undefined`**, `$s()` returns a snapshot object, `toJSON`/`Symbol.toPrimitive`, `mergeValue`, and a **single aggregate change event per batched update** | `Jsx6.js:30-51`, `JsxW.js:70-101`, `state.test.js` |
| K9 | `$S`/`$F` are **eager**: evaluated at creation, and recomputed on every declared dependency change even with no observer | `makeContext.test.js:47,98` (`$F(v => (value = v), …)` used purely for side effects) |
| K10 | `prepareSignal` returns public internals `{ $signal, fireChanged, listeners, setValue }`, and `ValueSymbol`/label/name are public | exported from `index.js:139`, asserted by `debug.test.js` |

### 1.3 In-repo consumer inventory (surface is small; the published contract is the risk)

| Consumer | Published? | Signal API used | Hard parts |
|---|---|---|---|
| [libs/jsx6/src/jsx2dom.js](../libs/jsx6/src/jsx2dom.js) | yes (`@jsx6/jsx6`, lockstep 1.8.18) | `observeNow` | C6 — the entire JSX binding mechanism is "any function is a signal" |
| [libs/jsx6/src/directives.js](../libs/jsx6/src/directives.js) | yes | `observeNow` + write-back on `input` | needs synchronous DOM update after a signal write (K7) |
| [libs/jsx6/src/trans.js](../libs/jsx6/src/trans.js) | yes | `$F`, `subscribeSymbol`, `triggerSymbol` assigned onto a **hand-made fake signal** | C3 — auto-tracking cannot see this object; must keep the duck-typed path |
| [libs/jsx6/src/Jsx6.js](../libs/jsx6/src/Jsx6.js), [libs/w/src/JsxW.js](../libs/w/src/JsxW.js) | yes | `$State`, `mergeValue` | K8 reset semantics, `$s()` snapshot |
| [libs/jsx6/src/Loop.js](../libs/jsx6/src/Loop.js) | yes | `observeNow`, `signal`, `$State` | a loop rebuild runs **inside** an effect → nested-effect disposal hazard |
| [libs/w/src/Loop.js](../libs/w/src/Loop.js) | yes | `observeNow`, `signal`, `$State` | same |
| [libs/signal-dom/index.js](../libs/signal-dom/index.js) | yes | `observeNow` | rAF batching interacts with alien batching |
| [libs/signal-clock/index.js](../libs/signal-clock/index.js) | yes | `$F`, `observe`, `observeNow`, `signal` | `$F(toMs, time)` derived chains; writes from a rAF loop |
| [apps/repl/src/index.jsx](../apps/repl/src/index.jsx), [intersect.jsx](../apps/repl/src/intersect.jsx) | yes (`@jsx6/repl`, lockstep) | `$S`, `$F`, `$State`, `signal` | in-JSX derived signals |
| [apps/nodditor](../apps/nodditor/src/index.jsx) | standalone pkg | `$State`, `observeNow` | low usage |
| [tools/eslint-plugin-jsx6/rules/signal-dependencies.js](../tools/eslint-plugin-jsx6/rules/signal-dependencies.js) | yes | none (static analysis) | encodes the *manual dep list* convention; relevance changes if auto-tracking lands |
| [docs/api.md](../docs/api.md), [libs/signal/README.md](../libs/signal/README.md), [doc/signals.md](../libs/signal/doc/signals.md), [doc/observe.md](../libs/signal/doc/observe.md) | docs site | — | document the eager/manual contract that would change |

**External consumers:** `@jsx6/signal` is published (lockstep group, `MODULE_VERSIONING.md:13`),
documented in `docs/api.md:30-45`, and its **CDN entries are `unpkg: cjs/index.js` + `module:
./index.js`** (`libs/signal/package.json:9-18`). Anything that imports `@jsx6/signal` today must
keep working — see §8 for the two real risks (transitive dependency, bare-specifier CDN usage).

---

## 2. alien-signals reference (verified against 3.2.1)

### 2.1 Package facts

| Fact | Value |
|---|---|
| Version / license | `3.2.1`, MIT, published 2026-05-14; `latest` is the only dist-tag ([npm](https://registry.npmjs.org/alien-signals/3.2.1)) |
| Runtime dependencies | **none** (105 dependents; **6.55 M weekly downloads**, 31.3 M monthly) |
| Formats | `esm/index.mjs` + `cjs/index.cjs` + `types/index.d.ts`; subpaths `.`, `./esm`, `./cjs`, `./system` (algorithm only, for building your own surface) |
| Size | [bundlephobia](https://bundlephobia.com/api/size?package=alien-signals@3.2.1): **5,449 B min / 1,950 B gzip**. Published files are *not* minified (`esm/index.mjs` 9,170 B, `esm/system.mjs` 6,620 B; measured gzip of the pair = 3,152 B) |
| Packaging notes | **no `main`/`module` fields — `exports` only** (old resolvers, e.g. webpack 4 / older Jest, need config); **no `sideEffects` flag since 2.0.5**, so bundlers cannot aggressively tree-shake it; `./esm` under `require` maps to `.mjs` (needs Node ≥22.12 `require(esm)`) |
| Provenance | the author wrote Vue 3.4's reactivity; the algorithm was [ported into Vue 3.6](https://github.com/vuejs/core/pull/12349), is used by vue language-tools and XState's atom port, and passes 180/180 of the cross-framework reactivity conformance suite |
| Version history | 1.0.0 (2025-01-14) → 2.0.0 (2025-04-30, deferred/pull evaluation) → 3.0.0 (2025-09-27) → 3.2.1. **v3 renamed `getCurrentSub`/`setCurrentSub` to `getActiveSub`/`setActiveSub`, removed `pauseTracking`/`resumeTracking`** (1.x only, deprecated in 2.x), added `trigger` in **3.1.0** and effect **cleanup return values** in **3.2.0**. The adapter needs ≥3.2.0 for cleanup semantics → pin `^3.2.1` and treat the probe suite as the upgrade gate (C15) |

### 2.2 Exact public API of 3.2.1 (from the published `types/index.d.ts`)

```ts
signal<T>(initialValue?: T): { (): T | undefined; (value: T | undefined): void }
computed<T>(getter: (previousValue?: T) => T): () => T
effect(fn: () => void | (() => void)): () => void          // runs immediately, returns stop
effectScope(fn: () => void): () => void
trigger(fn: () => void): void                              // manual invalidation
startBatch(): void; endBatch(): void; getBatchDepth(): number
getActiveSub(): ReactiveNode | undefined; setActiveSub(sub?): ReactiveNode | undefined
isSignal(fn): boolean; isComputed(fn): boolean; isEffect(fn): boolean; isEffectScope(fn): boolean
```

Notably **absent** in 3.2.1: `pauseTracking`/`resumeTracking` (removed; untracked reads are done
with `setActiveSub(undefined)`), and any raw "subscribe" primitive. `signal()` writes return
`void` — there is **no built-in "did it change" signal**.

### 2.3 Behaviour, as measured (probe output quoted, see Appendix B)

| Question | Measured answer | Implication for JSX6 |
|---|---|---|
| Callable shape? | `signal(1)` is a plain function; `s()` reads, `s(2)` writes, write returns `undefined`; `s.name === 'bound signalOper'`; no `.get`/`.set`/`.value` | ✅ matches K1's shape; ❌ the `true`/`undefined` changed-result must be re-derived |
| Equality on write | `0`→same: no propagate; `NaN`→`NaN`: propagates; same object identity: no; new equal object: yes — i.e. `!==` | ✅ identical to K2's `===` semantics |
| Effect timing | `effect()` runs **immediately**, and re-runs **synchronously during the write**, before the writer continues | ✅ preserves K7 (stack trace, immediate DOM update) |
| Batching | `startBatch(); a(1); b(2); endBatch()` → dependent effect runs **once**; unbatched → twice | ⚠️ `$State`'s `batchLevel` must become `startBatch`/`endBatch` to keep K8's single aggregate event |
| `computed` | **lazy** (getter not run until read), memoized, recomputes on read after a write, result-compare gates downstream propagation; when watched, the getter runs during propagation and the effect sees a consistent value | ⚠️ conflicts with K9's eagerness — see §6 (Δ2) |
| Diamond | single glitch-free notification (`a=3, b=20, s=2` observed together) | ✅ fixes P2-4's glitchiness |
| Untracked read | `setActiveSub(undefined)` around the read removes the dependency (effect did **not** re-run) | the mechanism for K1's compare-before-write |
| Cleanup | a function returned from the effect body is the cleanup, run before the next run and on stop; cleanup reads are untracked | usable, but see the footgun below |
| **Cleanup footgun** | `effect(() => s())` → next run throws **`cleanup is not a function. (In 'cleanup()', 'cleanup' is 1)`** | 🚨 any concise-arrow listener returning a truthy non-function crashes. `observe($s, () => fired++)` returns `1,2,3…` |
| Nested effects | effects created inside an effect are **auto-disposed when the outer re-runs** and when the outer's branch is removed | 🚨 changes disposal ownership; JSX6 must create bindings as **roots** (`setActiveSub(undefined)`) to keep "one disposer per binding" |
| Effects created as roots | survive the outer effect's stop | ✅ the mitigation for the above |
| Write inside an effect | allowed; a self-feeding effect is silently limited to one extra run by the recursion guard | different from JSX6 (a self-feeding Set listener would recurse) — safer, but silent |
| In-place mutation | `arr().push(x)` does **not** notify; `trigger(arr)` / `trigger(() => {…})` fixes it | ✅ parity with today, plus a new capability |
| Unwatched computed | goes cold again after the last observing effect stops; reads stay correct | ✅ lets derived signals stop leaking (P2-4 (a)) |
| Brand checks | `isSignal(fn)` compares `fn.name === 'bound signalOper'` — a wrapped/adapted function **fails** it | do not use for duck-typing; keep `Symbol.for('signalSubscribe')` (K3) |

### 2.4 Known defects in 3.2.1 that the adapter must route around

All are upstream issues, none is a blocker, but each changes a design choice:

| Upstream | Symptom | Consequence for the adapter |
|---|---|---|
| [#122](https://github.com/stackblitz/alien-signals/issues/122) — closed, **fixed on master only, not in 3.2.1** | `trigger()` throws `TypeError: e.fn is not a function` (plus a spurious extra effect run) when a signal is *written* after being *read* inside the `trigger` callback | do not implement `triggerSignal`/duck-typed invalidation by writing signals inside `trigger(() => …)`; use `trigger(fn)` for **reads only**, and drive writes through the normal path |
| [#79](https://github.com/stackblitz/alien-signals/issues/79) | a `computed` read **standalone** (no subscriber) keeps its dependency links forever; the maintainer calls it by-design and recommends `effectScope(...)` + dispose | the "eager initial pull" for `$S`/`$F` (§5.3, K9) *is* a standalone read → create each derived's computed inside an `effectScope` and hand its disposer to the derived signal's `dispose()`, otherwise P2-4's leak is traded for a different leak |
| [#118](https://github.com/stackblitz/alien-signals/issues/118) — **open** (fix PR [#126](https://github.com/stackblitz/alien-signals/pull/126) open, also covers "a throwing computed never recovers") | a `stopped` effect that reads a signal again in the same run **re-subscribes**; a throwing `effect()`/`effectScope()` setup leaves live subscriptions and orphan children with no disposer | (a) never call a disposer and continue using the binding in the same run; (b) wrap effect creation so a throwing updater cannot leave a half-built binding — with `runFuncNoArg` inside the effect body, the body itself never throws (C11); (c) verify dispose-then-write in the test suite |
| [#123](https://github.com/stackblitz/alien-signals/issues/123) — open | mutually recursive computeds can hang or OOM (no depth guard) | JSX6 has no such graph today; if auto-tracking lands, add a "derived A depends on derived B depends on A" documentation warning (today the manual deps make the cycle explicit and finite) |
| [#46](https://github.com/stackblitz/alien-signals/issues/46) | very deep graphs can exceed the JS call stack (`Maximum call stack size exceeded` at ~10k links) | irrelevant for today's DOM graph sizes, but it means "the graph is iterative/stack-safe" is not a guarantee to rely on |
| [#96](https://github.com/stackblitz/alien-signals/issues/96) | unbalanced `startBatch`/`endBatch` leaves `batchDepth` > 0 permanently, after which effects never flush | `try/finally` around every batch (already required by §5.4) — an exception inside `$State.updateValue` would otherwise silently kill all DOM updates |
| [#97](https://github.com/stackblitz/alien-signals/issues/97) | an effect that throws inside `flush()` aborts the remaining queued effects | C11: keep `runFuncNoArg` around every listener body so one broken updater cannot cancel its neighbours |
| [#108](https://github.com/stackblitz/alien-signals/issues/108) — community benchmark | alien-signals can **lose** to a simple array-based implementation on wide / very dynamic graphs, with much higher update-time heap allocation (link objects are recreated) | JSX6's workload is exactly "many small signals + wide dynamic DOM graphs". Treat the performance claim as **unproven for this codebase** and make the spike measure it (§7 phase 0, §12 Q7) |

---

## 3. Contract mapping — jsx6 feature → alien-signals

| JSX6 capability | alien-signals equivalent | Verdict |
|---|---|---|
| Callable signal `$sig()` / `$sig(v)` | `signal()`, callable | **direct** |
| `$sig(v)` → `true` if changed | not available; `signal()` write returns `void` | **adapter** (untracked compare against a shadow value, or `setActiveSub(undefined)` read) |
| Listener `Set` + unsubscribe closure (`subscribeSymbol`) | `effect()` returns a stop function; no raw listener API | **adapter** — either keep the Set fan-out (cheap, exact K5) or wrap each listener in an effect (batching/glitch-free for free, but heavier and gets the cleanup footgun) |
| `triggerSymbol` / `triggerSignal` | `trigger(fn)` / `trigger(computed)` | **adapter** (thin) |
| `observe`/`observeNow`/`subscribe` incl. promise + observable interop | none — alien has no `.then`/`.subscribe` duck-typing | **adapter**; the promise/observable branch stays hand-written |
| `$S(fn, ...deps)` / `$F(fn, ...deps)` eager manual derived | `computed` (auto-tracking, lazy) | **adapter + behavioural change** (K9) |
| ``$S`text ${$sig}` `` template form | none | **adapter** (keeps working via `signalValue`) |
| `$If`, `$Map`, `$Any`, `$Or`, `$EQ`, … filter helpers | none | **keep as-is** (they are one-liners over `$F`) |
| `$State` proxy, reset semantics, `toJSON`, `Symbol.toPrimitive`, `mergeValue` | none | **keep the proxy**, re-back the leaves; use `startBatch`/`endBatch` for atomicity |
| `staticSignal` (non-reactive callable) | none | **keep as-is** (no alien involvement) |
| `asSignal(promise/observable)` | none | **keep**, backed by an alien `signal` |
| `makeContext` / `makeSignalContext` | none | **keep as-is** |
| Duck-typed fake signals (`trans.js`) | not visible to auto-tracking | **must keep the symbol path**; derived signals need a non-alien invalidation route |
| `ValueSymbol`, `label`, `name` (devtools) | alien node internals are not exposed | **adapter**: keep the wrapper's own label/name/value symbol |
| Recursion/cycle safety | built-in (`Recursed` flag) | **new capability** (silent no-op instead of a stack overflow) |
| Batching for DOM updates (`signal-dom` rAF `runInBatch`) | `startBatch`/`endBatch` is *synchronous* batching, not rAF | **keep** the rAF batch; they compose, but the ordering must be re-verified (§9-C7) |

**Net:** nothing on the alien side maps 1:1 except the callable shape and the equality rule. The
adapter is not a thin file — it is roughly the size of the current implementation.

---

## 4. Options

| | Option | What changes | Benefit | Cost / risk |
|---|---|---|---|---|
| **A** | **Faithful adapter, derived → `computed`** (recommended) | `libs/signal` internals replaced; public API and symbols unchanged; `$S`/`$F` become auto-tracking, glitch-free, memoized | fixes P2-4; deletion-ready for the lint rule; battle-tested core; derived signals stop leaking | adapter ≈ 500–700 lines; 4 documented behavioural deltas; +1 transitive dep |
| **B** | **Core swap only** (keep eager manual `$S`/`$F`) | `prepareSignal` storage becomes alien | none material | pays every risk, gains nothing → **not a shipping direction**, but it is Direction C1 and is worth *measuring* as the control case in the portfolio's harness |
| **C** | **Native adoption / breaking v2** | runtime code written against `signal`/`computed`/`effect` directly; `@jsx6/signal` becomes a thin re-export or is dropped | cleanest long-term; biggest perf/size win; no adapter | breaks every published consumer (K1–K10 are the public contract); touches `jsx2dom`, `directives`, `Loop`, `trans`, `signal-dom`, `signal-clock`, both apps; semver **major**; high regression risk in a repo with **no CI** (D1) |
| **D** | **Don't migrate; fix P2-4 in place** | add laziness/glitch-freedom + auto-tracking to the existing 470-line core | no new dependency, no adapter, preserves K1–K10 exactly | re-implements a graph algorithm the alien project has already proven and benchmarked; ongoing maintenance |

**Recommendation (within direction C): A. Across all directions: see the portfolio.** C is only
defensible once the adapter has shipped and the ecosystem has been observed for a release; D is the
honest baseline to beat and should be re-examined if the 1.5-day spike (§7, phase 0) shows the
adapter exceeding ~700 lines. **B is no longer "not recommended" — under the clarified requirements
it is the cheapest way to give users computed signals (portfolio Direction B), and as a pure core
swap with no computed it is exactly Direction C1, worth *measuring* but not worth shipping alone.**

---

## 5. Recommended design (Option A)

Rules for the adapter, in priority order:

1. **Never let `effect` see a caller's return value.** Every user callback goes through
   `() => { cb(...) ; }` (or an explicit `return undefined`). This single rule defuses the
   `cleanup is not a function` footgun that breaks `observe($s, () => fired++)`.
2. **Every host binding is created as a root effect** — `const prev = setActiveSub(undefined); try {
   effect(...) } finally { setActiveSub(prev) }` — so a binding is disposed only by its own
   disposer, never by an enclosing effect re-running. This preserves P2-1's disposer model.
3. **`prepareSignal`'s returned shape and the two `Symbol.for` keys are frozen public API.**
4. **Reads always go through the alien signal** (`src()`) so auto-tracking works; the changed-flag
   compare uses a shadow value updated on write (no tracking pollution — verified safe via
   `setActiveSub`).

### 5.1 `src/signal.js`

```js
import { signal as alienSignal, effect, setActiveSub } from 'alien-signals'
const srcSymbol = Symbol.for('alienSignal')   // internal, not exported

export function prepareSignal(value, name) {
  const src = alienSignal(value)
  const listeners = new Set()
  let shadow = value                       // K2: `===` compare, exactly as today

  const $signal = (...args) => {
    if (!args.length) return src()          // tracks when read inside a computed/effect
    const v = args[0]
    if (v === shadow) return                // -> undefined, no propagation (K1)
    shadow = v
    src(v)                                  // alien propagates + flushes synchronously
    fireChanged()
    return true
  }
  // ValueSymbol / label / name / subscribeSymbol / triggerSymbol / toPrimitive / get: unchanged
}
```

* `asSignal`, `staticSignal`: unchanged except `asSignal` writes through the wrapper.
* `src` is also reachable for derived signals (§5.3) via the non-exported `srcSymbol`.

### 5.2 `src/observe.js`

* `_observe` keeps its four branches (internal signal / `.then` / `.subscribe` / static) verbatim —
  alien-signals does not model promises or observables, and this polymorphism is the documented
  public contract (`doc/observe.md`).
* `observeNow` / `observe` on an **internal signal** become:

```js
const observeSignal = (obj, callback, trigger, passValue) => {
  const prev = setActiveSub(undefined)               // rule 2: root effect
  let first = true
  let stop
  try {
    stop = effect(() => {
      const v = obj()                                // tracked read
      if (first) { first = false; if (trigger) callback(passValue ? v : undefined); return }
      if (passValue) callback(obj()); else callback()
      return undefined                               // rule 1
    })
  } finally { setActiveSub(prev) }
  return stop
}
```

* Alternative for this layer: keep the existing `Set`-based fan-out and use alien only for the
  derived/auto-tracking path. That is lower risk and preserves K5 exactly; it forfeits
  batched/glitch-free notification of *plain* listeners. **Decision point — see §12, Q2.**
* `triggerSignal` → `trigger(() => $signal())`; `isObservable` unchanged.

### 5.3 `index.js` — derived signals

```js
function createDerivedSignal(deps, fn, eager = true) {
  const c = computed(() => {
    deps.forEach(readForTracking)   // honor declared deps even if fn does not read them (K9, `$s` aggregate)
    return fn()
  })
  const out = prepareSignal(undefined).$signal     // keeps symbols/label/listener contract
  const push = () => out(c())                      // publish into the callable signal
  if (eager) { /* root effect: effect(() => { push(); return undefined }) — preserves K9 */ }
  // subscribeSymbol on `out` also creates a root effect that pushes, so observers get
  // batched/glitch-free notification; the last observer leaving lets `c` go cold (P2-4 (a)).
  return out
}
```

* **Dispose the computed, or it retains its deps** (upstream #79): create `c` inside
  `effectScope(() => …)` and expose the scope's stop through a new non-breaking
  `disposeDerived($sig)` / `$sig.dispose()` so `@jsx6/jsx6`'s `addDisposer` story (P2-1) can release
  the graph. Without this the eager initial pull leaks exactly like today's never-released derived
  subscriptions.
* `$F(filter, ...deps)` → `fn = () => filter(...deps.map(signalValue))` — this both tracks and
  yields values; the declared list keeps working for duck-typed deps.
* `$F` over a `$State` snapshot (`$F(({x, y}) => x + y, $s)`, `state.test.js:40`) sees a **new object
  every recompute**, so alien's `!==` result-compare always reports "changed". Where that matters,
  use the supported custom-equality idiom `computed(prev => eq(prev, next) ? prev : next)` — it is
  the documented workaround for the missing `equals` option
  ([#31](https://github.com/stackblitz/alien-signals/issues/31)).
* **Duck-typed deps** (`$translationsSignal`, `T(code)`, promises, `staticSignal`) are invisible to
  auto-tracking. For any dep that has `subscribeSymbol` but no `srcSymbol`, register the legacy
  `subscribe(dep, invalidate)` path and invalidate via a **read-only** `trigger(() => deps.forEach(readForTracking))`
  (see #122 in §2.4 — never write inside it). This is a hard requirement —
  `libs/jsx6/src/trans.js:37` (`$T`) breaks otherwise.
* Keep `$S(template)` with a single argument meaning "a signal whose value is `template`" — do
  **not** repurpose it for auto-tracking (the current API is ambiguous with function values).

### 5.4 `src/state.js`

* Keep the proxy, `specialProps`, `getValue`/`setValue`/`updateValue` semantics exactly (K8).
* Replace `batchLevel` with an exception-safe batch helper (never a bare `startBatch`/`endBatch`
  pair — an exception between them would wedge the scheduler permanently, upstream #96):

```js
const batch = fn => { startBatch(); try { return fn() } finally { endBatch() } }
```

  so all child writes in one `mergeValue`/`$s({...})` form **one** batch → dependent effects run once
  (keeps `state.test.js` "derived signal batching" and "child signal immediate vs aggregate
  batching" green), and `fireChanged` still fires exactly once per changed batch.
* `mergeValueSymbol`/`toJSON`/`Symbol.toPrimitive` unchanged.

---

## 6. Behavioural deltas (the part that must be reviewed, not assumed)

| # | Delta | Who can notice | Mitigation |
|---|---|---|---|
| Δ1 | `$S`/`$F` results become **lazy/memoized and glitch-free**: a diamond-shaped graph no longer exposes intermediate values, and a derived signal stops recomputing when its inputs changed but its result did not. Note the corrected baseline: the current core already **suppresses notification** when the recomputed value is `===` the old one (`src/signal.js:78-82`), so the change is to *when work happens* (recomputation becomes lazy/cached) and to intermediate **values**, not to "a listener fires on every write" | tests that count recomputations vs notifications; app code depending on intermediate values | intended fix; re-baseline the affected counts after review. Measured baseline probe: `experiments/signal-directions/harness/probe-current-contract.js` |
| Δ2 | Derived signals with **no observer** may no longer update (if the "lazy" variant of §5.3 is chosen) | `makeContext.test.js:47-54, 98-119` use `$F(v => (value = v), …)` discarding the result | keep the eager variant (default) **or** change those two tests and document "side-effect derived signals must be observed" |
| Δ3 | Nested-effect disposal: an effect created inside an effect is disposed when the outer re-runs | `Loop` item rebuilds trigger DOM rebuilds inside an effect | rule 2 (root effects for host bindings) + a regression test per binding site |
| Δ4 | Signal function identity: `$signal.name === 'bound signalOper'` would leak to devtools unless the wrapper redefines `label`/`name` | `debug.test.js:4-13` | wrapper keeps `label`/`name` — already the plan |
| Δ5 | A self-writing listener no longer recurses (alien's recursion guard) | theoretical; JSX6 currently relies on no such pattern | document; do not rely on the guard |
| Δ6 | `isSignal`/`isComputed`/`isEffect` from alien are **not** usable brand checks for adapted functions | nothing in-repo | never use them; keep `Symbol.for('signalSubscribe')` |
| Δ7 | A derived signal now owns a `computed` whose dependency links are retained until disposed (eager standalone read, upstream #79) | memory profile of long-lived `$State` + many derived signals | create derived computeds in an `effectScope` and expose `dispose()`; wire it into `@jsx6/jsx6`'s `addDisposer` (P2-1) |
| Δ8 | A derived signal can no longer be *coerced* to a number/string by the library alone — alien signals have no `Symbol.toPrimitive`; the adapter must keep its own (it already does today) | any `$sig + 1` / `${$sig}` usage | adapter retains `Symbol.toPrimitive`/`get` on the wrapper (non-negotiable) |

Everything else (K1–K8, K10) is preserved by construction and must be proven by the existing tests,
unchanged — **the 30 existing tests are the acceptance criteria and must pass without edits**
(except the Δ2 tests if the lazy variant is chosen).

---

## 7. Work plan and effort

Ordered, each phase ends with `bun run check` green (D1: local gate only, no CI proposals).

| Phase | Work | Est. |
|---|---|---|
| 0 | **Spike** in `experiments/alien-signal-spike/`: adapter prototype for `signal`/`observe`/`$S`, run the 30 existing tests against it, re-run the probes in-repo, and **measure** (a) `libs/jsx6` + `libs/w` suite wall-time, (b) a DOM-heavy loop/table update microbench, (c) heap after create/dispose of 10k bindings. Go/no-go gates: adapter > 700 lines, > 3 tests needing semantic edits, no measurable win in (b)/(c), or a regression in (a) | **1.5 d** |
| 1 | `src/signal.js` over alien (wrapper, shadow compare, symbols, label/name, `staticSignal`, `asSignal`) | 1 d |
| 2 | `src/observe.js` (`observe`/`observeNow`/`subscribe` over root effects, no-arg guarantee, promise/observable branches, `triggerSignal`) | 1.5 d |
| 3 | `src/state.js` (`startBatch`/`endBatch`, reset semantics, proxy, `mergeValue`) | 1.5 d |
| 4 | `index.js` derived signals (`computed` + declared-dep tracking + duck-typed invalidation + template form) | 2 d |
| 5 | Port/extend the signal test suite: keep the 7 files green, add regression tests for the cleanup footgun, root-effect disposal, duck-typed dep invalidation, batch counts | 1.5 d |
| 6 | Consumer validation: `libs/jsx6` (incl. `trans.js` bridge and `Loop`), `libs/w`, `libs/signal-dom`, `libs/signal-clock`, `apps/repl`, `apps/nodditor` suites | 2 d |
| 7 | Packaging: root `catalog` entry, `libs/signal` `dependencies`, `esm`/`cjs` rebuild, manifest audit, `dist/*.d.ts` diff vs today | 1 d |
| 8 | Docs: `libs/signal/README.md`, `doc/signals.md`, `doc/observe.md`, `docs/api.md:30-45`, mark P2-4 done in `plan/improvement-plan.md` (and reopen line 242), CHANGELOG/version notes | 1 d |
| 9 | Release `1.9.0` (lockstep group) + downstream smoke: `apps/repl` static rebuild (`bun run docs:build`), `unpkg` tarball inspection | 1 d |
| | **Total** | **≈14–15 focused days (≈3 calendar weeks)** |

Minimal Option B would be ~7–9 days and is **not recommended** (§4). Option C is ~4–6 weeks and a
major release.

---

## 8. Impact on projects using `@jsx6/signal`

### 8.1 In-repo

* **No source changes required** for `libs/jsx6`, `libs/w`, `libs/signal-dom`, `libs/signal-clock`,
  `apps/*` under Option A — that is the acceptance criterion. The only expected edits are:
  * `libs/jsx6/src/trans.js` — the duck-typed `$translationsSignal`/`T()` bridge must be covered by
    the adapter (rule in §5.3); this file is the canary for the whole K3 contract.
  * `libs/jsx6/src/Loop.js`, `libs/w/src/Loop.js`, `jsx2dom.js`, `directives.js` — reviewed, and
    regression-tested, for the nested-effect rule (Δ3); ideally **zero** edits.
  * `libs/signal-dom/index.js` — review only: rAF batching now wraps alien batches; ordering must be
    verified, not assumed.
  * `tools/eslint-plugin-jsx6` — the `signal-dependencies` rule stays (declared deps still matter for
    duck-typed deps and for eager breadth); it may be downgraded from `warn` to `off` in a later
    release only after auto-tracking proves complete.
* **All package suites must stay green**: `bun run check` runs `bun test` per package, `tsc -p`
  declaration emit, `tsc --noEmit` with `checkJs`, `oxlint --deny-warnings`, `oxfmt --check`,
  `check-versions.js`, `check-docs.js`, `check-manifests.js`, `check-workspace.js`
  ([scripts/verify.js:154-290](../scripts/verify.js#L154-L290)).
* `docs/demistify` is built from `apps/repl/static` by `bun run docs:build` and is gated by
  `check-docs.js` — it must be rebuilt in the same commit if the runtime output changes at all.

### 8.2 Published-package / external consumers

| Risk | Detail | Mitigation |
|---|---|---|
| **New transitive dependency** | `@jsx6/signal` has `dependencies: {}` today; it gains `alien-signals`. `scripts/check-manifests.js:316-343` requires every bare import in shipped raw source to be a **runtime** dependency (`shipsRawSource`, line 277-280, is true because the `default` export is `./index.js`) | add to root `catalog` + `dependencies: { "alien-signals": "catalog:" }`; only `libs/signal` declares it (avoids `check-workspace.js` version drift) |
| **CDN ESM direct-import breakage** | `module: ./index.js` and `exports.import: ./index.js` are the raw source. A bare `alien-signals` specifier does not resolve in a browser without an import map → anyone doing `<script type="module" src="…/@jsx6/signal/index.js">` breaks | publish-side fix: keep the bundled `esm/index.js` (inlines alien-signals) as the documented CDN entry and/or add an `imports`/import-map note to the README; `unpkg`/`cjs` entries already bundle and are unaffected. **Verify with `npm pack --dry-run` + unpkg inspection in phase 9** |
| **Bundlers** | Vite/webpack/esbuild/rollup consumers resolving `import` get a bare specifier — normal, installed by npm | none |
| **`prepareSignal` internals consumers** | `{ $signal, fireChanged, listeners, setValue }`, `ValueSymbol`, `label`, `name` are public | keep byte-compatible; no signature change |
| **Types** | JS + JSDoc, `checkJs`; `dist/index.d.ts` is emitted and published. alien's `{ (): T; (value: T): void }` does not match `Signal<T> = (value?: T) => T\|boolean\|undefined` | keep JSX6's own `@typedef Signal` on the wrapper; diff the emitted `dist/*.d.ts` before/after as a gate |
| **Semver** | lockstep group at `1.8.18` | ship as **`1.9.0`** (minor: additive/adapter, no API removal); bump all 8 lockstep packages via `bun run bump` |
| **Behavioural change for external users** | Δ1/Δ2 (§6) are observable | document in `CHANGELOG`/README release notes; if the lazy variant (Δ2) is chosen, that is still minor-semver-arguable — flag it explicitly in the release notes |

---

## 9. Caveats and gotchas (the ones that will actually bite)

* **C1 — The `effect` cleanup footgun.** `effect(() => expr)` treats a truthy non-function return as
  a cleanup and throws `cleanup is not a function` on the *next* run. Verified:
  `effect(() => s())` throws; `effect(() => { … })` (block body) is safe. JSX6 callbacks are full of
  concise arrows returning assignment results (`observe($s, () => (value = $s()))`) and counters
  (`() => fired++`). **Rule 1 in §5 is mandatory**, and a dedicated regression test (`() => fired++`
  type callbacks) is required.
* **C2 — Nested effects are owned by their parent.** Auto-disposal on outer re-run silently changes
  who owns a binding; inside `Loop`/`$v`-driven rebuilds this can dispose live DOM bindings. Create
  host bindings as root effects (rule 2) and add a regression test per binding site.
* **C3 — No `pauseTracking`/`resumeTracking` in 3.2.1.** Untracked reads require
  `setActiveSub(undefined)` + restore in a `finally`. Any compare-before-write (K1's changed flag)
  must be untracked, or every effect that writes a signal also subscribes to it.
* **C4 — `signal()` writes return `void`.** The `true`/`undefined` contract must be re-derived; if
  re-derived by reading the signal, the read is tracked (C3) — use a shadow value.
* **C5 — Batching is not automatic.** Two writes in one operation run dependents twice unless wrapped
  in `startBatch`/`endBatch`. `$State.updateValue`/`setValue` and any other multi-write path must be
  wrapped, or the "one aggregate event" tests break.
* **C6 — `computed` is lazy, and a derived signal that nobody observes may never update** (Δ2). This
  directly conflicts with K9 and with `makeContext.test.js`; decide eagerly (§12, Q3).
* **C7 — alien batching ≠ rAF batching.** `signal-dom`'s `runInBatch` defers DOM writes to the next
  animation frame; alien's batch is synchronous. They compose, but the guarantee "at most one DOM
  write per signal per frame" must be re-verified (test with `setAnimFunction`).
* **C8 — In-place mutation never notifies.** Unchanged from today, but if the migration tempts anyone
  to delete `$State`'s explicit write paths, remember `trigger()` is required for array/object
  mutation. (`$State.updateValue` currently does not `trigger` — the same pre-existing gap.)
* **C9 — Brand checks are by function name.** `isSignal`/`isComputed`/`isEffect` will not recognise
  adapted functions, and they **throw** if passed `null`/`undefined`. Keep `Symbol.for` duck-typing
  (K3 in §1.2) for cross-package/cross-version interop; never call the alien predicates on
  user-supplied values. The **caveat list in this section is numbered C1–C22 independently** of the
  contract invariants K1–K10 in §1.2 — a reference of the form "K*" is a contract invariant, "C*" is
  a caveat.
* **C10 — Recursion is silently swallowed.** A self-feeding effect runs once and stops (no error);
  the documented escape hatch is clearing `ReactiveFlags.RecursedCheck` on `getActiveSub()`, which
  needs `import { ReactiveFlags } from 'alien-signals/system'` — and that is a **`const enum`**
  declaration, which fails with TS2748 under `isolatedModules`/`verbatimModuleSyntax`. If any JSX6
  listener writes the signal it reads, the update will be lost *silently*. Add a test; do not rely
  on the escape hatch.
* **C11 — Error handling differs.** Alien runs effect bodies inside its own propagation; a throwing
  updater propagates differently than `runFuncNoArg`'s `try/catch` + `console.error`
  (`signal.js:119-125`). Keep `runFuncNoArg` around every listener call to preserve the
  "one bad listener does not break the batch" behaviour.
* **C12 — `dist/*.d.ts` is committed and published.** It is regenerated by the gate; a changed
  declaration is a public type change. Diff it deliberately.
* **C13 — Bundle size is roughly a wash, not a win.** alien ≈3.2 KB gzip (unminified) replaces an
  ≈11–16 KB custom core, but adds a 500–700 line adapter. Do not sell this migration as a size
  reduction.
* **C14 — Debuggability.** Today a signal is a function with `label`/`name`/`ValueSymbol` and a
  visible `listeners` Set. After the migration the graph lives inside alien's linked lists; keep the
  wrapper's `label`/`name` and consider a `debugListeners()`-style hook to avoid losing the
  stack-trace-first debugging story that `README.md:7` calls a priority.
* **C15 — Version pinning and upgrade gate.** alien-signals' public API churned across 1.x/2.x/3.x:
  `pauseTracking`/`resumeTracking` existed only in 1.x (deprecated in 2.x, **gone in 3.x**),
  `getCurrentSub`/`getCurrentScope` were v2-only and became `getActiveSub`/`setActiveSub` in v3,
  `trigger` arrived in 3.1.0, effect cleanup return values in 3.2.0. The adapter depends on
  *implementation-adjacent* behaviours (synchronous flush, cleanup semantics, standalone-computed
  retention), not only on the typed API, so pin `^3.2.1` in the catalog **and** keep the probe suite
  (`experiments/`, §7 phase 0) as the mandatory upgrade gate. Note that master already contains an
  unreleased fix for #122 — do not build on master; wait for a release.
* **C16 — Async boundaries.** Effects are synchronous; an `await` inside a listener body loses the
  active sub for the post-await part. Not an issue for today's consumers, but worth a note in
  `doc/observe.md`.
* **C17 — `trigger()` + write is broken in 3.2.1** (upstream #122, fixed on master only). Reading and
  then writing a signal inside a `trigger` callback throws. Invalidation helpers built on `trigger`
  must be read-only, and any "batch of writes plus a manual trigger" helper must write *outside* the
  callback.
* **C18 — Standalone `computed` reads retain dependency links forever** (upstream #79). This is the
  one upstream issue that directly attacks the reason for migrating (fixing P2-4's leak), so the
  design must own it: `effectScope` + an explicit `dispose()`.
* **C19 — No cycle/depth protection** (upstream #123 open; #46: ~10k links overflow the JS stack).
  Auto-tracking makes a recursive derived graph *possible* where the manual dep lists made it
  explicit today; document the hazard and do not claim stack safety.
* **C20 — No `main`/`module` fields, only `exports`.** Old resolvers and some test runners cannot
  resolve `alien-signals`; since `libs/signal`'s raw `index.js` will import it as a bare specifier,
  any consumer toolchain that ignores `exports` breaks. The bundled `esm`/`cjs` entries inline it —
  which is one more reason to make the bundled entry the documented CDN/toolchain-facing one.
* **C21 — No `sideEffects: false` in alien's package.json** (dropped after 2.0.5), so bundlers treat
  it as side-effectful and may retain more than necessary. `libs/signal`'s own `sideEffects: false`
  stays correct (the adapter adds no module-level side effects).
* **C22 — The performance case is unproven for this codebase.** #108 reports alien-signals losing to a
  plain array-based implementation on wide/very-dynamic graphs with substantially higher
  update-time allocation, while its published benchmarks are JIT-less microbenchmarks of propagation.
  JSX6's profile (many tiny signals, wide dynamic DOM, `Set` listener fan-out) is closer to the
  reported losing case than to the benchmark. **Do not justify the migration with performance until
  phase 0 measures it** on the repo's own suites (see the go/no-go metrics in §12 Q7).

---

## 10. Packaging, build and gate changes

1. `package.json` (root): add `"alien-signals": "^3.2.1"` to `catalog` (with the other catalog
   entries, lines 26-37); run `bun install` to update `bun.lock` (which **is** committed).
2. `libs/signal/package.json`: add `"dependencies": { "alien-signals": "catalog:" }` (replacing the
   empty object). Do **not** add it elsewhere — transitive resolution avoids `check-workspace.js`
   version-drift errors; `check-versions.js` errors if a catalog'd name is pinned any other way.
3. `libs/signal/tsconfig.json`: no change expected; `moduleResolution: bundler` resolves alien's
   `exports.types`. Keep `skipLibCheck: true`.
4. `esm`/`cjs` builds: `esbuild --bundle` inlines alien-signals into `esm/index.js` and
   `cjs/index.js` automatically — verify the bundled files grow by ~10 KB and still contain the
   alien core once (not twice: `import` and `require` paths).
5. `dist/`: regenerate declarations; diff `dist/index.d.ts` against the committed one.
6. `files` in `libs/signal/package.json` already ships `src/`, `dist/`, `esm/`, `cjs/`, `index.js` —
   no change. `sideEffects: false` stays valid (alien has no module-level side effects).
7. `scripts/check-manifests.js` / `check-versions.js` / `check-workspace.js` / `check-docs.js` must
   all pass; `bun run check --build` is the authoritative command.
8. `MODULE_VERSIONING.md`: version stays in lockstep; bump the recorded version, no structural edit.

---

## 11. Test plan and acceptance criteria

* **Unchanged and green:** all 7 signal test files (30 tests), plus `libs/jsx6`, `libs/w`,
  `libs/signal-dom`(if any), `libs/signal-clock` suites — via `bun run check`.
* **New regression tests** (added to `libs/signal/src/`):
  1. cleanup footgun: `observeNow($s, () => counter++)` and `observe($s, () => (v = $s()))` do not
     throw on the second change;
  2. root-effect disposal: a binding created while another effect is running survives the outer
     effect's re-run and stop (the `Loop`/`$v` scenario);
  3. duck-typed dep invalidation: `trans.js`-style fake signal (`fn[subscribeSymbol] = …`,
     `fn[triggerSymbol] = …`) still drives `$F(t, $code, $fakeSignal)`;
  4. batch counts: `mergeValue($s, {a, b})` → one aggregate event and one derived recompute;
  5. `triggerSignal` on a plain signal and on a derived signal;
  6. async: promise/observable interop unchanged (`asSignal`, `observe` on a promise);
  7. no-op writes: `NaN` propagates, `-0`/`0` does not, identical object does not.
* **Consumer smoke:** `apps/repl` in happy-dom/browser (the `intersect.jsx` `$F` chains and the
  `x-value` write-back path), `apps/nodditor` focus/observe path, `docs:build` + `check-docs.js`.
* **Acceptance:** `bun run check --build` exits 0; the only test-file diffs are the Δ2 tests if the
  lazy variant is chosen; `dist/*.d.ts` diff reviewed; `npm pack --dry-run` shows the alien core in
  the bundled entries and `dependencies` lists alien-signals.

---

## 12. Open questions / decisions needed

**These are the direction-C questions only.** The cross-direction decision protocol, the harness and
the pre-registered thresholds live in
[plan/signal-directions-portfolio.md §4 and §14](../plan/signal-directions-portfolio.md#4-the-shared-comparison-harness-do-this-first--it-is-what-makes-the-rest-comparable).

| # | Question | Recommendation |
|---|---|---|
| Q1 | **Reopen `improvement-plan.md` line 242** ("Auto-tracking / lazy signal graph — out of scope")? Without this the migration is not worth doing (§0.1) | yes — record the supersession in the plan doc |
| Q2 | Listener fan-out: keep JSX6's `Set` (exact K5/K10, cheap, no batching of plain listeners) or wrap each listener in an alien `effect` (batched + glitch-free, but heavier and exposes the cleanup footgun unless rule 1 is followed)? | start with the **Set** (lower risk), migrate to effects only if profiler data justifies it |
| Q3 | Derived signals: keep eager (§5.3 default, K9 preserved, leak unchanged) or go lazy (Δ2, `makeContext.test.js` edited, P2-4 (a) solved)? | keep **eager** in `1.9.0`; consider lazy in `2.0.0` with an explicit `observe`-required contract |
| Q4 | Keep the `jsx6/signal-dependencies` lint rule? | keep; revisit one release after auto-tracking ships |
| Q5 | Is a second, alien-native entry point wanted (`$C`/`derived` with auto-tracking, no declared deps) exposed publicly? | not in `1.9.0`; keep the surface frozen |
| Q6 | Should `experiments/alien-signal-spike/` be kept as the upgrade-regression harness (C15)? | yes — it is the cheapest guard against a future alien-signals major |
| Q7 | **What is the go/no-go metric for phase 0?** Which workload decides "this was worth it"? | propose: no regression in the full `bun run check --build` time, ≤700 adapter lines, 30/30 tests unchanged, and a measurable win in allocation/heap for a create-and-dispose loop test; if none is met, stop and take Option D |
| Q8 | Was 3.2.1's `#118` (stopped-effect re-subscribe) ever observed in the adapter? | add an explicit test: `stop(); write();` must not run the updater and must not re-link |

---

## Appendix A — references

* [stackblitz/alien-signals](https://github.com/stackblitz/alien-signals) · [README](https://raw.githubusercontent.com/stackblitz/alien-signals/master/README.md) · [src/index.ts](https://raw.githubusercontent.com/stackblitz/alien-signals/master/src/index.ts)
* [npm registry metadata for alien-signals@3.2.1](https://registry.npmjs.org/alien-signals/latest) · [published types/index.d.ts](https://unpkg.com/alien-signals@3.2.1/types/index.d.ts)
* Vue 3.6 port of the algorithm: [vuejs/core#12349](https://github.com/vuejs/core/pull/12349)
* TC39 signals proposal (referenced by `libs/signal/README.md:13`): [tc39/proposal-signals](https://github.com/tc39/proposal-signals)
* Repo decision record D1 (no CI) and P2-4: [plan/improvement-plan.md](../plan/improvement-plan.md)

## Appendix B — probe scripts

Probes were run in a scratch project **outside the workspace** (`%TEMP%\alien-probe`, `bun add
alien-signals` → 3.2.1), so no repo manifest or lockfile was touched. Three scripts
(`probe.mjs`, `probe2.mjs`, `probe3.mjs`) exercised 60+ behaviours; the load-bearing results are
quoted in §2.3. Reproduce with:

```bash
mkdir -p /tmp/alien-probe && cd /tmp/alien-probe
bun init -y >/dev/null && bun add alien-signals@3.2.1
bun run probe.mjs   # API shape, timing, equality, computed laziness, batching, diamond, nesting, trigger, scope
bun run probe2.mjs  # cleanup footgun, root-effect creation, dynamic deps, batch flush, ordering, teardown writes
bun run probe3.mjs  # tracking pollution from compare-reads, subscribe skip-first-run, unwatched computed, in-place mutation
```

Copy the three probe files into `experiments/alien-signal-spike/` as part of phase 0 so they can be
re-run against future alien-signals versions (C15).