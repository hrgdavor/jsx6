# The frozen comparison contract

Every direction in `experiments/signal-directions/` is loaded **by path** and exercised through the
single case list in [`harness/contract.js`](harness/contract.js). Nothing is compared by reading code
or by trusting a description: a direction either satisfies a case or it does not.

A case declares the capabilities it needs. A direction that does not claim them is reported as
**skipped**, and the skip is part of the result — "this direction has no computed primitive" is a fact
about the direction, not a missing measurement.

## What every direction must export

The superset of the current public API plus the new axes. `meta` is required:

```js
export const meta = {
  id: 'a-compat',
  name: 'A — compatibility / interop layer',
  backend: 'untouched current core + alien bridge',
  capabilities: ['core', 'interop', 'interop:bridge-required', 'batch'],
  deps: ['alien-signals 3.2.1 (vendored, optional peer in a real release)'],
  sourceRoot: '.', // where this direction's own code lives, for the LOC count
  notes: 'free-form: what it does not do, and why',
}
```

| group | names |
|---|---|
| core (must be present in every direction) | `signal`, `prepareSignal`, `staticSignal`, `asSignal`, `subscribeSymbol`, `triggerSymbol`, `observe`, `observeNow`, `subscribe`, `isObservable`, `$S`, `$F`, `$State`, `mergeValue`, `makeContext`, `makeSignalContext` |
| computed axis | `$C`, `$CE`, `dispose` |
| batching | `batch` |
| interop axis | `alien`, `toAlien`, `toSignal`, `isAlienSignal`, `isAlienComputed` |

`$C(fn, ...deps)` is the single calling shape: dependencies are **optional**. An implementation that
auto-tracks ignores them; one that does not (F) requires them; one that cannot express them (E, whose
`$C` *is* `alien.computed`) will fail the dependency-form cases and must not claim `computed`.

## Capability glossary

| capability | meaning |
|---|---|
| `core` | the K1–K10 contract from `plan/signal-alien-signals-migration.md` §1.2 holds |
| `union-deps` | `$S`/`$F` invalidate on declared dependencies **and** on reads tracked during evaluation |
| `computed` | `$C(fn, ...deps)` works with an explicit dependency list over the core's own signals |
| `computed:auto` | `$C(fn)` auto-tracks the core's own signals with no dependency list |
| `computed:dynamic-deps` | dependencies are re-derived on **every** recomputation, so a branch that appears later is followed |
| `computed:eager` | `$CE` evaluates at creation and recomputes on invalidation without being read |
| `computed:alien-only` | auto-tracking works, but only for **alien** values (jsx6 signals must be bridged first) |
| `dispose` | `dispose($c)` releases the computed's dependency subscriptions |
| `batch` | `batch(fn)` coalesces at least the alien-level effect queue |
| `batch:core` | `batch(fn)` also coalesces **this core's** own graph, so an eager derived does not see intermediate values |
| `interop` | alien nodes can be observed, used in JSX, and used as derived dependencies; bridges exist both ways |
| `interop:bridge-required` | a bare jsx6 signal read inside an alien `computed` is **not** tracked; `toAlien()` first |
| `interop:no-bridge-needed` | the core's signals *are* alien nodes, so a bare read is tracked (no bridge tax) |
| `alien-surface` | alien's own `effect`/`effectScope`/`trigger`/`startBatch` are exposed to users |

## Verification requirement (not a capability — a hard gate)

Keep the copied baseline suites green:

```bash
cd experiments/signal-directions/b-native-computed/signal && bun test   # 30 pass / 0 fail
cd experiments/signal-directions/c-alien-backend/signal   && bun test   # 30 pass / 0 fail
```

Those 7 test files / 30 tests are **byte-identical copies of `libs/signal`'s own tests** (verified by
SHA-256), so passing them is evidence that a new backend or a new computation layer did not change
existing behaviour. A direction that edits them is disqualified, not adjusted.

Second gate, for directions that claim to work in the real app:

```bash
bun experiments/signal-directions/d-dual-surface/app-compare.js
```

It builds `apps/repl` unmodified against each backend, proves the redirect took effect by searching
the bundle for an implementation-specific marker, then boots it headlessly and asserts what rendered.
Results: [`APP-RESULTS.md`](APP-RESULTS.md).

## Pre-registered decision thresholds

Fixed **before** the results were seen, so the outcome cannot be rationalised afterwards:

* **Keeper** — contract clean, copied baseline suites green, macro-bench within **+10 %** of the
  untouched baseline, retained heap per long-lived component within **+10 %**, ergonomics no worse,
  and at most one new dependency.
* **Conditional** — within **+25 %** on the macro bench with clearly better ergonomics.
* **Kill** — macro-bench worse than **+25 %**, retained heap worse than **+30 %**, a K1–K10 invariant
  needing a test edit, or consumer files needing edits in more than two places.

The thresholds are applied in `plan/signal-directions-portfolio.md` §4.5 / §14; the measurements they
are applied to are in [`RESULTS.md`](RESULTS.md).