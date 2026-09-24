# Signals: direction portfolio — keep eager, add computed, enable coexistence

**Created:** 2026-09-23
**Supersedes the single-recommendation framing of**
[plan/signal-alien-signals-migration.md](../plan/signal-alien-signals-migration.md), which is kept as
**(a) the deep alien-signals evidence base and (b) the full specification of Direction C**.
**Scope:** `libs/signal` and every in-repo consumer, the published-package contract, and a shared
experiment harness that lets all directions be implemented **independently and compared**.
**Inputs:** the user's steer — *JSX6 targets long-lived components and the eager API is a good fit;
allow coexistence with alien-signals and explore it as a backend; the main driver is letting users
have **computed** signals; multiple directions may be implemented side by side and judged later.*

---

## 0. What changed in the framing

The earlier document optimised for one question: *"how do we replace our core with alien-signals
without breaking anyone?"* That is now only one of several viable directions, and its premise was
wrong in one important way:

* **Eager is a feature, not debt.** For long-lived components, eager propagation gives synchronous,
  stack-trace-visible updates and no recomputation deferred to a later read. Both the earlier plan
  and this one must treat "eager stays" as a constraint, not as something to migrate away from.
* **The actual gap is not "our graph is worse".** Measured on this repo's own access pattern, the
  current eager core is **as fast as or faster than** alien-signals-backed variants (§1.3). What the
  current library genuinely lacks is an *ergonomic* feature: a `computed` primitive with automatic
  dependency tracking. That can be added natively in ~4 days (Direction B) without any dependency.
* **Therefore the decision is about ergonomics, coexistence and maintenance — not performance.**
  This document defines six directions, the harness that makes them comparable, and the
  pre-registered thresholds that decide which ones survive real usage.

---

## 1. Requirements and constraints

### 1.1 What must not change (the contract)

The ten load-bearing invariants are catalogued as **K1–K10** in
[plan/signal-alien-signals-migration.md §1.2](../plan/signal-alien-signals-migration.md#12-the-load-bearing-contract-what-may-not-change):
callable signals with a `true`/`undefined` changed result, `===` change detection, the
`Symbol.for('signalSubscribe')`/`signalTrigger` duck-typing protocol, `observeNow`'s
signal/static/Promise/Observable polymorphism, the zero-argument `subscribe` guarantee, "any
function-valued prop is a signal", synchronous propagation, `$State` proxy semantics with
reset-to-`undefined` and one aggregate event per batch, eager `$S`/`$F`, and the public
`prepareSignal` internals. **Every direction below is measured against these, and the existing 30
signal tests plus the consumer suites are the acceptance gate.**

### 1.2 New requirements (the user's steer)

| # | Requirement | Implication |
|---|---|---|
| R1 | Users can write **computed** signals (derive from other signals without listing dependencies) | needs auto-tracking; the highest-value gap (§2) |
| R2 | **Eager stays** the default; eager is the right model for long-lived components | no direction may make laziness mandatory; a lazy computed is *additive* |
| R3 | **Coexistence** with alien-signals must be possible — either world may drive the other | a bidirectional bridge is a first-class deliverable, not a migration step |
| R4 | alien-signals as a **backend** is a legitimate direction to explore | Direction C; must be judged on ergonomics/maintenance, not perf |
| R5 | Several directions will be **implemented and compared**, then pruned | requires isolated, parallel implementations + a shared harness |
| R6 | Components are **long-lived** | memory is a primary criterion: retention per component, subscription release, dispose behaviour |

### 1.3 Measured evidence that reframes the decision

Run against the real `alien-signals@3.2.1` (probe scripts: see the
[evidence appendix](../plan/signal-alien-signals-migration.md#appendix-b--probe-scripts); the interop
probe is reproduced in §4.6).

| Measurement | Result | Reading |
|---|---|---|
| Interop: alien `computed` reading **bridged** jsx6 signals | works; jsx6 write → computed updates | R3 is achievable and cheap |
| Interop: alien `computed` reading jsx6 signals **without** a bridge | **does not track** (reads are plain calls, value is stale) | the bridge is mandatory, not optional |
| alien `computed` used where JSX expects a signal (via compat `observeNow`) | works as a child/attribute value; dispose stops it | `{$computed}` in JSX is reachable without touching `jsx2dom` |
| Writing an alien `computed` | silently returns `undefined`, value unchanged, **no error** | ergonomic difference vs a jsx6 signal (writable) |
| 200k × (write + derived read), single run, no warm-up | native alien **10.7 ms**; bridged jsx6→alien **14.4 ms**; **current if (eager listener chain) 11.4 ms**; alien source + eager mirror **12.2 ms** | bridge costs **~26 %** over today; alien-as-backend is **~7 % slower** than today. **Performance does not justify migrating** |
| Two-dep update through a bridge, no batching | 2 notifications (intermediate *value* visible) | consistent with the measured core contract below |
| **CORRECTED — recompute vs notify in the current core** (probe: `experiments/signal-directions/harness/probe-current-contract.js`) | computed value unchanged (`a % 2` over `a = 3`) → **recomputes 1, notifies 0**; computed value changed → recomputes 1, notifies 1 | recomputation is **unconditional**, notification is **value-guarded** by the `===` check in `prepareSignal.setValue`. Listeners do *not* fire for every intermediate write |
| Same probe: two **child** deps (`$s.x`, `$s.y`) written separately | notifications `[12, 22]` — the intermediate value is observable | the glitch is real but *narrower* than "fires on every write": it needs multiple deps **and** a differing intermediate value |
| Same probe: `$s({ x, y })` with **child** deps | notifications `[15, 55]` — `$State`'s own batching does **not** cover child-level subscriptions | `$State` coalescing only helps the **aggregate**-dep form |
| Same probe: `mergeValue` with the **aggregate** dep (the shape `state.test.js:121-133` uses) | notifications: 1 | coalescing works when batching **and** aggregate dependency coincide |
| **Implemented-and-measured results for all six directions** | `experiments/signal-directions/RESULTS.md` (facade contract + micro/macro benches) and `APP-RESULTS.md` (real `apps/repl` on each backend) | the plans below are no longer hypotheses: every direction exists, passes its contract, and has numbers |
| Real app on each backend | baseline / B / C all **10/10 app checks, 0 console errors**; `index.js` 49.2 kB → 54.4 kB (**+10.6 %**) → 64.3 kB (**+30.8 %**) | both candidate cores run the unmodified REPL; C's cost is visible and bounded |
| Long-lived-component macro bench (300 components, 3000 writes, unmount) | updates: baseline 7.2 ms, B 6.6 ms, C 8.1 ms, A/E/F 7.0–7.1 ms; retained heap 631 kB → 642–681 kB | **all six are viable on the workload that matters**; the decision is ergonomics/capabilities/dependency policy |
| Micro hot paths (2M write+read; 4-deep eager chain) | B **−2 % / +9 %**; C **+90 % / +192 %**; A/E/F ±3 % / ±4 % | a full storage swap is the expensive part of C, not its graph; B's auto-tracking is nearly free **after** collecting dependencies once instead of on every recomputation (a naive design measured **+744 %**) |

*These are indicative single-run figures with no warm-up or repetition; the harness in §4 replaces
them with medians of N and must be the source of truth. The direction of the result — "the current
core is competitive" — is the point.*

---

## 2. The gap today, stated concretely

Everything `$S`/`$F` can do, they can only do with a **manually maintained dependency list**, policed
by the `jsx6/signal-dependencies` lint rule. That produces four user-visible limitations:

1. **No way to derive without listing deps.** `$S(() => $a() + $b(), $a, $b)` — omitting `$b` is
   silently wrong and only a lint warning catches it (`libs/signal/index.js:39-65`).
2. **No memoization of *work*.** `createDerivedSignal` runs `$signal(getValue())` on every dependency
   notification (`libs/signal/index.js:23-28`), so a derived signal recomputes even when the result is
   unchanged — measured: 1 recomputation, 0 notifications. The *notification* side is already
   value-guarded (`===` in `prepareSignal.setValue`, `src/signal.js:78-82`), so downstream listeners
   are **not** woken for every write. What is missing is laziness and cached invalidation: an
   expensive derived signal pays its cost on every dependency write, and there is no way to compute it
   only when read.
3. **No glitch-free ordering for multi-signal dependencies.** A derived signal that depends on
   several signals written separately can expose an intermediate *value* (measured: `[12, 22]` for
   `$s.x` + `$s.y` deps, and also `[15, 55]` for `$s({x, y})`, because `$State`'s internal batching
   only coalesces the **aggregate** dependency). The aggregate-dep form with a batched multi-key write
   (`mergeValue`, which is what `state.test.js:121-133` exercises) does coalesce correctly — so the
   gap is narrower than "no batching at all", but it is real and it is why a `batch()` primitive is
   worth adding.
4. **No laziness option.** There is no way to say "compute this only when read", which matters for
   expensive derivations in long-lived components that are rendered rarely.

Directions B, C and F address 1–4 by different means; A and E address the coexistence axis (R3)
without touching the core; D exists to make the comparison real.

---

## 3. Directions at a glance

| ID | Direction | New dependency | What users get | Blast radius | Effort | Cheap/keystone |
|---|---|---|---|---|---|---|
| **A** | **Compat / interop layer** | alien (optional peer) | alien computed/effect usable today; jsx6 signals usable inside alien graphs; `{$computed}` in JSX | **none** on existing code; one new opt-in module | 2 d | keystone for C/E/F |
| **B** | **Computed + auto-tracking + batching in the current core** | none | `$C` (lazy, memoized, auto-tracking), eager `$CE`, `batch()`, glitch-free derived, union-deps `$S`/`$F` | core internals; public API **additive** only | 4–5 d | **best value/risk** |
| **C** | **alien-signals as backend behind the adapter** | alien (runtime dep) | same callable/eager API; battle-tested graph; scopes; C2 variant adds lazy auto-tracking | core rewrite + packaging + consumer validation | 10–13 d | expensive; the only reason is maintenance/graph quality |
| **D** | **Dual-surface A/B harness** | depends on chosen backends | nothing directly — it makes C vs B comparable **in the real apps** | `experiments/` only | 2–3 d | comparison machinery |
| **E** | **alien-native surface as the computed answer** | alien (optional peer) | `computed`/`effect`/`effectScope`/`trigger` documented as the official computed API | none; docs + one module | 1–1.5 d (after A) | cheapest path to R1 **if** the alien API is acceptable |
| **F** | **Bridge-only hybrid (`$C` over bridged deps)** | alien (optional peer) | `$C(fn, ...deps)` = lazy alien computed over bridged jsx6 signals; core untouched | **none**; ~40 lines after A | 1 d (after A) | cheapest way to try computed **with** alien's algorithm |

**Read of the table:** A, B, E, F are all cheap and mutually compatible; implement them first. C is
the only expensive direction and its payoff is maintenance/graph quality rather than speed or
features B cannot provide. D is how you decide.

---

## 4. The shared comparison harness (do this first — it is what makes the rest comparable)

Without a fixed harness, six independent implementations cannot be compared. The harness defines one
**contract**, one **test matrix**, one **benchmark protocol**, one **ergonomics rubric**, and
pre-registered **thresholds**.

### 4.1 The facade contract every direction must satisfy

Each direction provides a module exporting the same names, so the harness imports a direction by path
and runs identical code paths:

```js
// required by the harness (superset of today's public API, additive only)
signal, prepareSignal, staticSignal, asSignal, subscribeSymbol, triggerSymbol,
observe, observeNow, subscribe, triggerSignal, isObservable,
$S, $F, $State, mergeValue, makeContext, makeSignalContext,
// computed axis (each direction may implement any subset; missing = "not supported")
$C,            // lazy, auto-tracking, memoized  -> returns a callable signal
$CE,           // eager computed (auto-tracking)
batch,         // fn => fn(), glitch-free multi-write
dispose,       // release a computed/derived graph
// interop axis (A/C/D/E/F only)
toAlien, toSignal, isAlienSignal, isAlienComputed
```

What may **not** be satisfied differently: K1–K10, and the existing 30 signal tests, unmodified.

### 4.2 Interop matrix (must pass for any direction claiming R3)

| # | Case | Observed on the real library |
|---|---|---|
| I1 | alien `computed` over **bridged** jsx6 signals; jsx6 write updates it | ✅ works (probe) |
| I2 | jsx6 signal read inside alien `computed` **without** a bridge | ❌ does not track — must be documented as unsupported |
| I3 | alien `computed` as a JSX child and as an attribute (`x-if`, `class`) | ✅ works via compat `observeNow` |
| I4 | jsx6 signal / `$State` child read inside an alien `effect` (bridged) | ✅ works |
| I5 | stop/unsubscribe propagates both ways; no further updates after dispose | ✅ works |
| I6 | `$State` proxy child inside `$C`/alien computed; `$s.x++` round-trip | ✅ works (bridged) |
| I7 | duck-typed fake signal (`trans.js`) still drives `$F`, and through a bridge if claimed | must not regress |
| I8 | `asSignal(promise).then` → alien computed / jsx6 observer | must not regress |
| I9 | manual invalidation (`triggerSignal` / alien `trigger`) across the boundary | partially — `trigger` on a *bridged* node needs an isolated test |
| I10 | two-dep update in a batch → exactly one notification, no intermediate value | ✅ with batching |
| I11 | teardown: retained heap after disposing 10k bridged pairs | to measure |
| I12 | cleanup footgun: a value-returning listener callback must not crash | confirmed crash on the naive bridge (`effect(() => s())` → `cleanup is not a function`); the compat layer must wrap every callback |

### 4.3 Benchmarks

* **Micro** (median of ≥5 runs, warm-up first): signal write+read throughput; fan-out to N listeners;
  diamond depth 1/4/16; computed hit vs miss; subscribe/unsubscribe churn; `startBatch` batch of K
  writes; heap per 10k signals and per 10k computed; heap after dispose.
* **Macro** (the numbers that actually decide): keyed `Loop` with 1k rows and 10k updates; mount 500
  long-lived components → 20k writes → unmount (time + retained heap); `apps/repl` boot and
  `bun run docs:build`; `bun run check` wall-time.
* **Correctness under load**: run the full `bun run check --build` with the direction's core swapped
  in (this is the real gate; the bench numbers only rank).

### 4.4 Ergonomics rubric (score each direction 1–5, with the code that proves it)

| Criterion | How it is scored |
|---|---|
| Lines of code for 8 canonical patterns (derive, derive-with-deps, conditional class, list item, form field, debounce, `$State` merge, teardown) | measured LOC from the harness cases |
| Import/API surface a user must learn | count of exported names they touch |
| Typing effort (JSDoc + emitted `dist/*.d.ts`) | diff size vs today; does the callable `Signal<T>` type survive |
| Failure modes | what happens on: missing dep, writing a computed, missing dispose, recursive derived |
| Debuggability | stack trace of a write → DOM update; devtools label/name; ability to inspect the graph |
| Doc burden | pages to add/change (`docs/api.md`, `README.md`, `doc/signals.md`, `doc/observe.md`) |
| Footguns exposed to users | count (e.g. alien's cleanup-return semantics, `startBatch` pairing) |

### 4.5 Pre-registered decision thresholds

Decide these **before** implementing, so the outcome is not rationalised afterwards:

* **Keeper** if: full `bun run check --build` green with the existing tests unmodified **and**
  macro-bench within **+10 %** of today's core **and** retained heap per long-lived component within
  **+10 %** **and** ergonomics score ≥ today's **and** it adds at most one dependency.
* **Conditional** if it is within +25 % and its ergonomics clearly win (e.g. B's `$C`).
* **Kill** if the macro-bench regresses **>25 %**, retained heap grows **>30 %**, any K1–K10 invariant
  needs a test edit, or consumers must be edited in more than two files.

### 4.6 Evidence already collected (interop prototype)

A minimal faithful mirror of the jsx6 core plus the ~40-line compat layer shown in §5 was driven by a
~200-line probe (the four probe scripts, including the interop one, were run in a scratch project
outside the repo — `%TEMP%\alien-probe` — against `alien-signals@3.2.1`; the three semantics probes
are quoted in the earlier document's
[Appendix B](../plan/signal-alien-signals-migration.md#appendix-b--probe-scripts)). Results are quoted
in §1.3 and §4.2. **Phase 0 should re-create the interop probe as
`harness/interop.test.js` inside the repo and delete the scratch copy**, so the numbers in this
document stay reproducible and are re-runnable against a future alien-signals release.

---

## 5. Direction A — compatibility / interop layer (no core change)

**Goal.** Make the two worlds usable together today, with zero risk to existing behaviour. This is
R3, and it is the keystone the other alien-based directions build on.

**Public API** (new opt-in entry, e.g. `@jsx6/signal/alien` or a separate `@jsx6/signal-alien`
package):

```js
toAlien($sig)            // jsx6 signal -> alien signal node (one listener + one alien signal)
toSignal(alienNode)      // alien signal/computed -> jsx6 callable signal (one root effect)
isAlienSignal(x), isAlienComputed(x)
// plus: observe/observeNow gain a branch that understands alien nodes,
//       so `{$computed}` and `x-if={$computed}` work in JSX unchanged
```

**Design** (validated, see §4.6):

```js
const isAlien = x => typeof x === 'function' && (isSignal(x) || isComputed(x))

function toSignal(node) {                     // alien -> jsx6
  const o = signal()
  const prev = setActiveSub(undefined)        // root effect: independent disposer
  try { o.dispose = effect(() => { o(node()); return undefined }) }   // wrap: never return a value
  finally { setActiveSub(prev) }
  return o
}
function toAlien($s) {                        // jsx6 -> alien
  const a = alienSignal($s())
  $s[subscribeSymbol](() => { const p = setActiveSub(undefined); try { a($s()) } finally { setActiveSub(p) } })
  return a
}
```

Three subtleties that must be in the code, each empirically confirmed:
1. **Wrap every user callback** so `effect` never receives a returned value (else
   `cleanup is not a function`).
2. **Write untracked** (`setActiveSub(undefined)` around the bridge write), or the bridge effect
   becomes its own dependency.
3. **The bridge is required for tracking**: an alien computed reading a bare jsx6 signal does not
   track (I2). Bridge or don't claim it.

**Dependencies / packaging.** Static import of `alien-signals` inside an opt-in module. Keep the main
entry dependency-free: declare `peerDependencies: { "alien-signals": "^3.2.1" }` with
`peerDependenciesMeta.optional = true`, add it to the root `catalog`, and make sure the compat module
is **not** reachable from `index.js` (subpath export or separate package) so
`scripts/check-manifests.js` stays satisfied without forcing the dependency on every consumer.

**Blast radius.** None: no existing file changes except an optional `isObservable`/`observe` branch,
which is additive and truth-preserving for non-alien values.

**Effort.** 2 d (module + interop matrix I1–I12 + packaging + docs).

**Performance.** Bridge overhead measured at **~26 %** on a synthetic write+read loop. Per bridge:
one alien signal + one listener; per `toSignal`: one alien root effect. Batching must be explicit
(§9-C5), so a multi-dep bridge can emit intermediate values unless the caller batches.

**Ergonomics.** Users can adopt alien immediately (`{$computed}` just works); jsx6 signals can feed
alien graphs. No new mental model for existing code.

**Disadvantages.** Two reactive systems in one app with two sets of rules; every crossing costs an
extra node; lazy-by-default alien computed next to eager jsx6 signals can surprise; users must know
which side a value lives on; the cleanup-return semantics leak into the compat API.

**Keeper / killer.** Keep if `{$computed}` in a real app is worth ~26 % on the crossed paths and the
docs stay short. Kill if it stays unused after one release, or if bridge bookkeeping causes a
long-lived-component heap regression (R6).

---

## 6. Direction B — computed + auto-tracking + batching **inside** the current core

**Goal.** Give users `computed` (R1) while keeping eager as the default (R2), with **no new
dependency**, and fix the glitch and leak drawbacks in the same change. This is the cheapest path to
the user's actual goal.

**Public API (additive).**

```js
$C(fn)                  // lazy, memoized, auto-tracking computed -> callable signal
$CE(fn, ...deps)        // eager computed: evaluates now and on every dep change (auto-tracked ∪ deps)
batch(fn)               // glitch-free multi-write: recompute/notify once, in dependency order
$c.dispose()            // release a cold computed's dependency subscriptions
// $S / $F become union-dependency eager computeds (see below) — same call shape, same behaviour
```

**Design.**

1. **Tracking hook (≈3 lines).** `prepareSignal`'s getter registers itself with an active collector:

   ```js
   const $signal = (...args) => {
     if (!args.length) { if (activeCollector) activeCollector.add($signal); return value }
     ...
   }
   ```
   One `if` on the read path — negligible, and zero when no computation is in flight. This works
   because **we own the getter**, which alien-signals cannot do for foreign signals (I2).
2. **`$C(fn)`** — on first read: clear old deps, set `activeCollector`, run `fn`, subscribe
   `invalidate` to each collected dep, cache the value. On `invalidate`: mark dirty (do **not**
   recompute — that is the laziness contract). On read while dirty: recompute.
   *Retention (R6):* deps are held from the first read until the owner releases them. Decide between
   (a) reference-counted auto-release when the last listener unsubscribes, and (b) an explicit
   `$c.dispose()` plus a documented "release your computeds" rule — (a) costs a counter and is
   friendlier for long-lived components, (b) is simpler and matches the discrete, explicit style the
   library already uses for `observeNow` unsubscribes. Harness I11 measures the difference.
3. **`$CE(fn, ...deps)`** — same tracking, but `invalidate` pushes an eager recompute. Because the
   dependency edge is just the **existing listener mechanism** (`subscribeSymbol` → `listeners.add`),
   no new graph machinery is needed: one Set per signal, exactly as today.
4. **Glitch-freedom via `batch(fn)`.** Add a module-level `batchDepth` and a `Set` of signals whose
   value changed. The write path becomes: *inside a batch, record the signal and mark dependents
   dirty instead of calling `fireChanged`; at `batchDepth === 0`, recompute dirty computeds in
   dependency order (each computed knows its depth = 1 + max(dep depth), computed during tracking)
   and then fan out to listeners once per changed signal.* `$State.updateValue`/`setValue` call
   `batch` internally so the existing "one aggregate event" tests stay green **and** the
   child-dependency case stops exposing intermediate values (measured today: `[15, 55]` for
   `$s({x, y})` with child deps). Note that deferring the *fan-out* — and not merely the recompute —
   is what removes the glitch, because a derived's invalidation travels through the ordinary listener
   Set. Also note the scope of this fix: notification is **already** value-guarded today, so `batch`
   buys (a) the missing coalescing for child-dependency graphs, (b) skipped recomputation work, and
   (c) it is a prerequisite for eager computeds to be glitch-free. A **lazy** `$C` needs no batching
   to avoid intermediate values at all — an unobserved computed simply has not evaluated yet.
5. **Union-dependency `$S`/`$F` (strictly backwards compatible).** A derived signal's dependency set
   becomes *(declared deps)* ∪ *(reads auto-tracked during evaluation)*. Consequences:
   * every currently-working call keeps working **exactly** as before — declared deps that the
     callback never reads still invalidate (this is the case that makes naive auto-tracking a
     breaking change: `$S(() => $s.x(), $s)` today also reacts to `$s.y`);
   * a **forgotten** dep now still produces a correct update, which is the ergonomic win the lint rule
     was faking — the rule can eventually be retired, not because deps stop mattering, but because
     omission stops being a bug;
   * `$F(fn, ...deps)` keeps passing values as before, and additionally tracks any signal the filter
     reads directly.
6. **Duck-typed/fake signals** (`trans.js`) cannot be auto-tracked; they keep the declared-dep path,
   so `$T` and `$translationsSignal` are unaffected (K3 preserved).
7. **No new semantics for `$State`**: children are ordinary signals, so `$C(() => $s.x() * 2)` and
   `$C(() => $s().x + $s().y)` both work — the second tracks every child because `getValue()` reads
   them all.

**Dependencies / packaging.** **None.** `libs/signal/package.json#dependencies` stays `{}`; no
catalog entry; no bundling change; CDN/raw-entry story unchanged.

**Blast radius.** `src/signal.js` (getter hook), new `src/computed.js`, `src/observe.js` (batch-aware
notification), `index.js` (`$C`, `$CE`, `batch`, union-dep `$S`/`$F`), `src/state.js` (delegate its
`batchLevel` to `batch`). Consumer files: ideally **zero**.

**Effort.** 4–5 d (≈200–300 lines + tests + docs). Breakdown: tracking hook 0.5 d; `$C`/`$CE` 1.5 d;
batch + dependency order 1 d; union-dep `$S`/`$F` 0.5 d; dispose/leak handling 0.5 d; tests/docs 1 d.

**Performance.** Expected to be *the fastest* direction on this workload (it removes alien from the
hot path entirely): measured baseline is today's **11.4 ms** per 200k write+read vs **12.2 ms** for the
alien-backed eager variant. The read-path `if` and the batch counter are the only additions; the
harness must confirm ≤+5 %.

**Ergonomics.** Best of the set: one paradigm, one mental model; `$C` is optional and additive; eager
stays the default; `$S`/`$F` get *more* forgiving without changing meaning; no new footguns;
debuggability is unchanged (still a callable function with `label`/`name` and a visible `listeners`
Set); no dependency to install or explain.

**Disadvantages.** We own the reactivity algorithm and its edge cases (cycles, deep graphs,
re-entrancy) — that is the maintenance cost alien-signals would remove; topological ordering in
`batch` is new code with its own tests; a `computed` written by a user silently ignores the write
(decide: no-op like alien, or throw in development); laziness introduces the
"cached until read" question users must learn.

**Keeper / killer.** Keep unless the macro-bench regresses >10 % or the batch/topo code proves
unmaintainable. This is the direction to beat, and it is the one the user's stated goal points at.

---

## 7. Direction C — alien-signals as the backend, behind an eager adapter

**Goal.** Keep the callable/eager public API (K1–K10) while the storage, propagation graph and
computed engine are alien-signals. The full specification — module-by-module design, packaging, 22
caveats, the upstream-defect workarounds, and the 14–15-day plan — is
[plan/signal-alien-signals-migration.md](../plan/signal-alien-signals-migration.md). Two variants:

* **C1 (eager adapter).** `prepareSignal` stores its value in an alien `signal`; the listener `Set`
  and synchronous `fireChanged` are kept; `$S`/`$F` remain eager (each derived mirrored by a root
  `effect`). Behaviour is identical to today by construction. **This is the variant that matches R2.**
* **C2 (hybrid auto-tracking).** C1 plus `$C`/`$CE` implemented as alien `computed`, and `$S`/`$F`
  rewritten as union-dependency eager computeds. This is "B's ergonomics with alien's graph".

**Public API.** Unchanged for C1. C2 adds the same `$C`/`$CE`/`batch`/`dispose` names as Direction B,
so the two can be compared on identical user code — that is intentional.

**Dependencies / packaging.** alien-signals becomes a **runtime** dependency of `libs/signal`
(catalog + `dependencies`), which changes the package's "zero dependencies" property and the CDN
raw-entry story; `esm`/`cjs` bundles inline it (today each of the six importing packages already
inlines its own private copy of the core, so the bundled story is unchanged in kind, only larger).
Full detail in the earlier document §8.2 and §10.

**Effort.** 10–13 d for C1 (adapter, consumer validation, and the harness run); **+3 d** for
packaging/docs/release, which is how the earlier document's 14–15 d figure is composed; **+2 d** for
C2's auto-tracking (the design is Direction B's, re-hosted).

**Performance.** Measured **12.2 ms** for "alien source + eager mirror effect" vs **11.4 ms** for
today's core on the same loop — i.e. **~7 % slower, not faster**. The graph advantages (glitch-free
diamonds, `checkDirty` memoization, scopes) benefit deep and wide graphs; this repo's workload is
many small signals over a wide DOM, which is precisely the case where a
[community benchmark](https://github.com/stackblitz/alien-signals/issues/108) reports alien-signals
losing to a simple array-based implementation. **Do not adopt C for speed.**

**Ergonomics.** Same public ergonomics as today (that is the point of the adapter), plus C2's
computed. Against B: alien's `computed`/`effect`/scopes are battle-tested and well documented, and we
stop maintaining a graph algorithm.

**Disadvantages.** ~500–700 lines of adapter that is *not* smaller than the 470-line core it wraps
(maintenance goes up, not down); one new runtime dependency for a package that had none; 22 documented
caveats including an open upstream defect set (#118, #123, #122-in-3.2.1) whose workarounds we own;
nested-effect disposal forces every host binding to be created as a root effect (or `Loop` rebuilds
dispose live DOM bindings); cleanup-return semantics must be wrapped everywhere; version churn across
1.x→3.x means the adapter needs a probe suite as an upgrade gate.

**Keeper / killer.** Keep only if C1 passes the whole gate unchanged **and** C2's ergonomics beat B's
**and** the team explicitly wants to stop owning the algorithm. Kill if the adapter needs consumer
edits, if the macro-bench regresses >10 %, or if the upstream defect list grows.

---

## 8. Direction D — dual-surface A/B harness (the comparison machinery)

**Goal.** Make the comparison happen **in the real applications**, not only in microbenchmarks, so
"let us decide after using it" is actually possible. This is R5. **Implemented** — see
`experiments/signal-directions/d-dual-surface/`.

**Design.** Two pieces:

1. **The facade + runner** (`harness/compare.js`, `harness/bench-one.js`) — every direction, plus the
   untouched baseline, exercised through one identical facade, each measured in its own process.
2. **The real-app runner** (`d-dual-surface/app-build.js`, `app-smoke.js`, `app-compare.js`) — builds
   `apps/repl` with `@jsx6/signal` redirected by an esbuild resolve plugin to a candidate core, proves
   the redirect took effect by searching the bundle for an implementation marker, then boots the
   bundle headlessly and asserts what rendered (static render, `Jsx6` class + function components,
   `Loop` items set through the `p` scope, `x-value` inputs, a synchronous `x-if` reaction, an async
   `Loop` re-render, and a **Promise used directly as a JSX child**).

**Constraints honoured.** No app source and no app build config was edited: the runner imports the
app's own `esbDef` from `src_build/buildScript.js`, calls esbuild directly with the alias plugin, and
writes to `d-dual-surface/.tmp/app-build/<backend>/` (gitignored). `--serve=<dir> --port=<n>` starts a
small `Bun.serve` static server so the REPL can actually be clicked through on a swapped core
(`live-server` was tried first and hung on HTML responses in this environment).

**Measured** (`APP-RESULTS.md`, generated):

| backend | `index.js` | vs baseline | app checks | alias proof | console.errors |
|---|---|---|---|---|---|
| `baseline` | 49.2 kB | — | 10 / 10 | `signalAlienSource` **absent** (correct) | 0 |
| `b-native-computed` | 54.4 kB | **+10.6 %** | 10 / 10 | `signalStateChildren` present | 0 |
| `c-alien-backend` | 64.3 kB | **+30.8 %** | 10 / 10 | `signalAlienSource` present | 0 |

**Read of the result:** the real app runs correctly on both candidate cores, and both stay within the
pre-registered bundle/behaviour envelope. C's +30.8 % is the advertised cost of vendoring an alien
backend into the entry bundle; B's +10.6 % is the computed/batching/tracking code itself.

**Effort.** 2–3 d, as estimated — spent.

**Disadvantages.** A third code path to keep green while it exists; risk of the facade becoming a
de-facto API if it leaks into documentation. The app smoke is not a substitute for human interaction.

**Keeper / killer.** It is scaffolding: delete it once the decision is recorded, keeping only the
harness (`harness/`) and the recorded results.

---

## 9. Direction E — alien's native surface as *the* computed answer

**Goal.** The cheapest possible way to satisfy R1: stop pretending we need our own computed, and
document alien's.

**Public API.** `@jsx6/signal/alien` (or the separate package) re-exports
`computed`, `effect`, `effectScope`, `trigger`, `startBatch`, `endBatch`, `signal` — with our naming
aliases (`$C = computed`, `$watch = effect`, `$scope = effectScope`) if that reads better.

**Design.** Only works in combination with **Direction A**: an alien `computed` must be recognised by
`observeNow`/`isObservable` before it can be used as a JSX child or attribute (I3). With A in place,
E is ~20 lines plus documentation.

**Dependencies / packaging.** Same optional-peer arrangement as A.

**Effort.** 1–1.5 d after A.

**Performance.** Whatever the bridge costs on crossed paths (measured ~26 % on crossed writes); pure
alien-to-alien graphs are alien's own performance.

**Ergonomics.** Users get the full, documented alien API immediately, including `effectScope` and
`trigger`. Risk: two paradigms with different rules (lazy computed, silent write to computed,
cleanup-return semantics, batch pairing) exposed directly to application authors, plus the need to
explain when to use `$S`/`$F` versus `$C`.

**Keeper / killer.** Keep if users actually reach for it and the docs stay short; kill in favour of B
if the two-paradigm confusion shows up in issues or code review.

---

## 10. Direction F — bridge-only hybrid: `$C` over bridged deps

**Goal.** Get a lazy auto-tracking `$C` **without touching the core at all** — A plus ~40 lines.

**Public API.**

```js
$C(fn, ...deps)   // lazily evaluates fn over deps; deps are bridged; returns an alien computed
```

**Design.** `$C = (fn, ...deps) => alienComputed(() => fn(...deps.map(d => toAlien(d)())))`, with the
bridges memoized per signal (a `WeakMap`), plus the compat layer from A so the result can be used in
JSX. One alien signal + one jsx6 listener per distinct dep; one alien computed per derived.

**Dependencies / packaging.** Same optional peer as A.

**Effort.** 1 d after A.

**Performance.** ~26 % overhead on crossed paths, and *no eager mode*: a `$C` with no reader never
updates, and writing it silently does nothing (measured). Bridging is per-dep and permanent unless
disposed, so long-lived components need an explicit dispose path (R6).

**Ergonomics.** Attractive for a quick win: `$C(fn, ...deps)` is an obvious, low-risk API for users
who already list dependencies, and it does not disturb any existing behaviour. But it is a *second*
computed implementation next to a hypothetical native one, and its laziness cannot be turned off.

**Keeper / killer.** Keep as the "try computed this week" option; kill once B (or C2) lands, unless it
wins the ergonomics rubric outright.

---

## 11. Combinations, sequencing and total effort

| Phase | Work | Effort | Depends on | Status |
|---|---|---|---|---|
| 0 | Harness: facade contract, interop matrix, micro/macro benches, ergonomics cases, promote the §4.6 probe | 1.5 d | — | **done** |
| 1 | **A** (compat) and **B** (native computed) in parallel — they touch disjoint code | 2 d + 4–5 d | 0 | **done** |
| 2 | **F** (`$C` over bridges) and **E** (alien API surface) — both small, both need A | 1 d + 1–1.5 d | 1 | **done** |
| 3 | **D** (facade + run `apps/repl` today's-core vs B; extend to C later) and the first decision review | 2–3 d | 1 | **done** |
| 4 | **C1/C2** (alien backend adapter) — only if the survivors leave a real gap | 10–13 d (+3 d docs/release) | 1, 3 | **done** (implemented as C for comparison; not graduated) |
| | **Total for everything** | **≈20–25 d** | | |

**Recommended order:** phase 0 → A + B (parallel, disjoint files) → D against `apps/repl` to compare
today's core vs B → F + E for the coexistence story → measure and prune → C only if the survivors leave
a real gap (maintenance of the algorithm, or graph quality B does not reach). Optionally run a short
extra plan for **B-on-eager-only** (skip `$C`, deliver `batch` + union-dep `$S`/`$F` + glitch-free
derived in ~2.5 days) as an even cheaper first milestone.

**Where this stands now.** All six directions are implemented under `experiments/signal-directions/`,
each passes the frozen contract, both copied cores pass `libs/signal`'s 30 tests unmodified, and the
real REPL runs on the baseline, B and C cores. Nothing has been graduated into `libs/signal` and no
existing source file was changed (one formatter-ignore line aside), so the decision below is still
open and reversible.

---

## 12. Repository layout for independent, parallel implementation

```
experiments/signal-directions/          # NOT a workspace: not linted, not in the gate's test discovery,
  README.md                            #   but it IS oxfmt-checked (oxfmt runs over the whole tree)
  contract.md                          # §4.1 facade contract + rubric + thresholds (frozen before coding)
  harness/
    facade.test.js                     # runs the contract against a direction by path
    interop.test.js                    # I1–I12
    bench-micro.js                     # §4.3 micro, medians + heap
    bench-macro.js                     # §4.3 macro (Loop, 500 long-lived components, unmount)
    ergonomics/                        # the 8 canonical patterns, one file per pattern per direction
  a-compat/
  b-native-computed/
  c-alien-backend/
  d-dual-surface/
  e-alien-native/
  f-bridge-hybrid/
```

Why this works with the repo's constraints (`plan/improvement-plan.md` D1/D2 — local gate only):
`scripts/verify.js` discovers tests only inside workspace packages, so `experiments/` cannot
destabilise the gate; `oxlint` runs on `libs tools scripts` only, so it will not flag experimental
code; `oxfmt --check` **does** cover the whole tree, so experimental files must be formatted. A
direction graduates into `libs/signal` only after it wins the decision review, and at that point it
must pass `bun run check --build`.

---

## 13. Risks that apply to every direction

1. **Consumers are not all covered by the gate.** `oxlint` skips `apps/` and only `libs/*` are
   type-checked (`scripts/verify.js:176-207,236-238`), so a regression that only manifests in
   `apps/repl` or `apps/nodditor` is caught only by manual smoke (`apps/repl` exercises `$S`, `$F`,
   `$State`, `x-if`, `x-value`, `Loop`, and `$s.x++`). Any direction's acceptance must include a
   scripted app smoke, not just `bun run check`.
2. **Latent bugs will be "fixed" by accident.** `apps/repl/src/index.jsx:44` calls the `$State` proxy
   with a function, which today wipes every key; `$State({...}, true)`'s second argument is silently
   ignored (`src/state.js:6`); `trans.js:33` returns a number where callers expect an unsubscribe
   (`jsx6/src/dispose.js:32`). Decide **fix or preserve** per direction and assert it in the harness,
   or the comparison will be confounded.
3. **Every direction must keep the disposal story.** `observeNow`'s unsubscribe return is what makes
   P2-1's `disposeNode` work, and long-lived components make it load-bearing (R6). Any bridging or
   computed layer needs an equally precise release path, or it will leak per component.
4. **Two reactive worlds double the documentation surface.** Whichever direction ships must add one
   clear rule for "which primitive do I reach for", in `docs/api.md`, `README.md`, `doc/signals.md`
   and `doc/observe.md`.
5. **Version/lockstep discipline.** Any published change bumps the whole lockstep group
   (`MODULE_VERSIONING.md:5-18`) and must keep `check-versions`/`check-manifests`/`check-workspace`
   green; a new dependency must go through the root `catalog`.

---

## 14. Decision protocol and next steps

**Decision taken and implemented.**

| outcome | what |
|---|---|
| **B graduated in place** | `libs/signal` now ships `$C`/`$CE`/`batch`/`dispose` and union-dependency `$S`/`$F`, with **no new dependency**. `libs/signal-alien`'s README and `RESULTS.md` quantify the cost (+1.0 kB gzip over 1.8.18 for the whole computed axis). |
| **C graduated as a new package** | **`libs/signal-alien`**, a **lockstep** member (same version, released together), implementing the same contract on alien-signals plus two-way interop. Its README documents the size breakdown: 4.2 kB gzip total = ~1.8 kB alien-signals + ~2.4 kB jsx6-side (B is 2.2 kB). |
| **A/E/F not shipped** | kept in `experiments/` as the interop evidence; their value was in the comparison. F is now largely redundant (the core has `computed` natively). |
| **D** | kept: `app-compare.js` + `dropin.js` are the regression harness for the two shipped cores. |

**A real bug was found by the graduation, and fixed:** `$S`/`$F` with a declared dependency whose
callback read the collector cannot see — the duck-typed translation signal in `libs/jsx6/src/trans.js`
is exactly this shape — subscribed to **nothing**, because the "already subscribed" fast path compared
the tracked set only. Language switches would have stopped updating `$T(...)`. Fixed in
`libs/signal/src/computed.js` (`depsAlreadySubscribed` now checks declared deps too) with two
regression tests; the copied 1.8.18 suite plus the new tests are green, and the A-direction interop
case that surfaced it now passes.

**Steer that led here:** a variant where jsx6 signals gain native `computed` support is acceptable
**even if it is not alien-compatible**, provided there is also a **drop-in replacement variant based on
alien-signals that supports what jsx6 signals currently provide**. Both are now verified rather than
asserted:

| claim | evidence (generated) |
|---|---|
| B gives jsx6 signals native `computed`, with **no dependency** and no interop requirement | `USAGE-AND-SIZE.md` §1 (T4–T7, T12), `RESULTS.md`, contract 33/33 |
| B is a drop-in replacement for the previous core | `DROPIN.md`: 46 shipped names all present, 0 regressions, `tsc` (declarations + `checkJs`) clean, esm+cjs build, the 1.8.18 suite green |
| C is an **alien-based** drop-in replacement that supports everything jsx6 provides today | `DROPIN.md` (same checks; `libs/signal-alien` row) + `APP-RESULTS.md` (unmodified `apps/repl` on the aliased core, 10/10, 0 console errors) |
| the only respect in which C is not a drop-in *package* | it adds a runtime dependency (alien-signals, pinned through the workspace catalog) and a bare specifier in the raw `index.js` entry; the bundled `esm`/`cjs` entries inline it |

**Protocol (kept for reference).** Freeze `contract.md` (facade, interop matrix, benches, rubric,
thresholds) before writing any direction code — done. Implement A, B, F (+ E, C) — done. Apply §4.5
mechanically:

| Outcome | Action |
|---|---|
| A direction is Keeper | graduate it into `libs/signal`, port the harness cases into `libs/signal/src/*.test.js`, bump the lockstep group as a minor |
| Two directions are Keepers and both are cheap | keep both behind explicit entry points (e.g. `$C` native **and** `@jsx6/signal/alien`) and document the split |
| Conditional | keep in `experiments/` behind an opt-in entry for one release, then re-measure |
| Kill | delete the directory; record the measurement that killed it so it is not re-proposed |

**Next steps.**

1. ~~Approve the harness contract~~ — done; frozen in `experiments/signal-directions/contract.md`.
2. ~~Implement B, A, F, E, C and D~~ — done; all six directions exist and pass the frozen contract.
3. ~~Graduate B and C~~ — done: B in place in `libs/signal`, C as `libs/signal-alien` in the lockstep
   group. `bun run check --build` is green (tests, declaration emit, `tsc --noEmit`, bundle builds,
   oxlint, oxfmt, versions, docs sync, manifest audit, workspace integrity).
4. **Version bump is the remaining release step.** The packages deliberately still carry `1.8.18`:
   the feature is implemented and verified, but bumping the lockstep group (and re-publishing
   `docs/demistify`, already rebuilt for the new core) is a release action, not part of the
   implementation. `bun run bump <version>` moves all nine lockstep packages plus
   `MODULE_VERSIONING.md`.
5. **CDN note for C.** The raw `index.js` entry now contains a bare `alien-signals` specifier; the
   bundled `esm`/`cjs` entries inline it. Point CDN users at the bundled entry (noted in
   `libs/signal-alien/README.md`).
6. **Keep the reports as the regression harness.** `dropin.js` + `app-compare.js` + the copied
   test suites are the cheapest guard against a future alien-signals major (portfolio C15) — and the
   place where the duck-typed-dependency bug below was caught.
7. Re-run the decision review after a release of real use, per §4.5 thresholds, and prune whichever of
   A/E/F was not adopted.