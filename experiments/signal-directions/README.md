# signal-directions — six implementations, one contract, one table

This directory implements the **direction portfolio** from
[plan/signal-directions-portfolio.md](../../plan/signal-directions-portfolio.md) as six standalone,
independently runnable modules. The experiments themselves only ever **copied** the signal core —
nothing in `libs/` was edited to build them.

## Status: two directions have been graduated

The portfolio has been decided and implemented for real. The experiments stay as the evidence and as
the regression harness for what shipped:

| shipped | where | what |
|---|---|---|
| **B** — native `computed` in the core | `libs/signal` (in place, version unchanged) | `$C`, `$CE`, `batch`, `dispose`, union-dependency `$S`/`$F`, no new dependency |
| **C** — alien-signals backend | **`libs/signal-alien`** (new package, lockstep group) | the same contract implemented on alien-signals, plus two-way interop |

Because B was graduated **in place**, `baseline/` no longer re-exports the workspace package: that link
would have silently turned the control into a second copy of B and made every "vs baseline" column
meaningless. The 1.8.18 sources are therefore **frozen** in `baseline/signal/` and re-exported, and the
quantity that answers "what did graduation change?" is `b-native-computed` (which is now what
`libs/signal` ships) against `baseline` (what it shipped before).

`dropin.js` and `d-dual-surface/` resolve the **real packages**, not the copies: the drop-in verdict and
the app results are about `libs/signal` and `libs/signal-alien`.

## Run it

```bash
bun experiments/signal-directions/harness/compare.js          # contract + benches → RESULTS.md
bun experiments/signal-directions/harness/report.js           # usage examples + sizes + interop → USAGE-AND-SIZE.md
bun experiments/signal-directions/harness/dropin.js           # drop-in verification → DROPIN.md
bun experiments/signal-directions/harness/size-packages.js    # shipped-package bundle sizes
bun experiments/signal-directions/d-dual-surface/app-compare.js  # real app → APP-RESULTS.md
bun experiments/signal-directions/harness/run-cli.js a-compat # contract only, one direction
cd experiments/signal-directions/b-native-computed/signal && bun test   # copied baseline suite
```

Not part of this comparison, but in the same experiments area: [`../signal-inspect/`](../signal-inspect/README.md)
serves a dev-console demo page (`bun experiments/signal-inspect/serve.js`) with one signal of every shape
on both shipped cores.

Every report is **generated**: task outcomes are executed, bundles are bundled and gzipped, interop
statuses are observed, and drop-in claims are checked against the shipped package's own surface and
test suite. Only the prose is written by hand.

### The real app (Direction D)

`apps/repl` is built **unmodified** with `@jsx6/signal` redirected to a candidate core by an esbuild
plugin, booted headlessly, and interrogated about what actually rendered:

```bash
bun experiments/signal-directions/d-dual-surface/app-compare.js            # build + smoke all three
bun experiments/signal-directions/d-dual-surface/app-compare.js baseline   # just the control
bun experiments/signal-directions/d-dual-surface/app-compare.js --serve=c-alien-backend --port=5123
```

The `--serve` form is the "use it for a day" step: it builds that backend's app and serves it at
`http://127.0.0.1:<port>/index.html` with a small `Bun.serve` static server, so the REPL can be
clicked through on the swapped core. (Not `live-server`: it injects a reload script into HTML
responses and that response hung here, while the JS and CSS served fine.)

Measured results are in [`APP-RESULTS.md`](APP-RESULTS.md): all three backends pass every app check
with zero console errors, and the `alias proof` column shows the redirect really took effect
(`signalStateChildren` present for B, `signalAlienSource` present for C, both absent for the
baseline).

The untouched baseline is a direction too (`baseline/` re-exports `@jsx6/signal` through the workspace
link), so every number has a control.

## The directions

| dir | what it is | dependency | computed? |
|---|---|---|---|
| `baseline/` | **control** — the real `libs/signal`, never copied, never edited | — | no |
| `a-compat/` | interop layer only: alien nodes become observable, jsx6 signals become alien-trackable | alien (opt-in) | no (use alien's) |
| `b-native-computed/` | `libs/signal` **copied**, then `$C`/`$CE`/`batch`/`dispose` + auto-tracking added inside it | **none** | yes, native |
| `c-alien-backend/` | `libs/signal` **copied**, then storage + graph replaced by alien behind the same public API | alien (runtime) | yes, alien's |
| `d-dual-surface/` | scaffolding: facade, the esbuild alias recipe, and the **real-app runner** | — | n/a |
| `e-alien-native/` | alien's own `computed`/`effect`/`effectScope`/`trigger` exposed next to the core | alien (opt-in) | alien's, as-is |
| `f-bridge-hybrid/` | A + ~15 lines: `$C(fn, ...deps)` = alien computed over bridged dependencies | alien (opt-in) | yes, bridged |

`_shared/alien-compat.js` is the compat layer A, E and F share (and C reuses for its interop
exports); it is counted separately as `+shared` in the results.

`vendor/alien-signals/` is a **byte-identical copy of the published npm tarball's ESM build**
(`alien-signals@3.2.1`, MIT) so the experiments need no install and no lockfile change. See
[`vendor/alien-signals/README.md`](vendor/alien-signals/README.md).

## How to read the results

* **`RESULTS.md`** — contract + micro/macro benchmarks, generated by `compare.js`. Each direction is
  measured **in its own process** (`bench-one.js`), because running six implementations in one process
  let earlier ones contaminate later measurements (the untouched baseline moved by 22 % purely from run
  order).
* **`USAGE-AND-SIZE.md`** — the same twelve tasks solved in each direction (code differences + executed
  outcomes), bundle size **plain / minified / gzipped** for a facade entry and for the real app, and
  the executed interop probe matrix. Generated by `report.js`.
* **`DROPIN.md`** — whether B and C can actually replace `@jsx6/signal` as-is: export-surface parity,
  behavioural parity on every contract case the shipped package passes, `tsc` declaration + `checkJs`
  cleanliness, `esm`/`cjs` bundle builds, and the untouched test suite. Generated by `dropin.js`.
* **`APP-RESULTS.md`** — `apps/repl` on each backend. Generated by `d-dual-surface/app-compare.js`.
* Every bench goes through the frozen facade, so no direction gets a cheaper code path.
* The **macro** bench is the one that matters for this project: 300 long-lived components, mounted,
  written to 3000 times, then unmounted with the stored unsubscribe functions.
* Micro benchmarks isolate single operations and therefore exaggerate differences. Relative columns
  are the result; absolute milliseconds are machine-specific.

## What the harness found (summary; details and numbers in RESULTS.md)

* **Interop is cheap and works** (A/E/F): `{$computed}` in JSX, alien computeds as `$S`/`$F`
  dependencies, and jsx6 signals inside alien effects. But a bare jsx6 signal read inside an alien
  computed is **not** tracked — `toAlien()` is mandatory.
* **C needs no bridge at all**, because its signals *are* alien nodes. That is the one structural
  advantage C has over every other direction, and it is a capability (`interop:no-bridge-needed`), not
  a claim.
* **C's storage swap costs the most on the hot path**: +90 % on a 2M write+read loop, +192 % on a
  4-deep eager chain, +219 % on `$State` merges — but on the long-lived-component macro bench it is
  within ~14 % on updates and ~5 % on retained heap, so the cost is real but not structural.
* **B's auto-tracking was expensive until it was fixed**: a naive re-collect-on-every-recompute design
  measured +744 % on chains. Collecting dependencies once (for `$S`/`$F`, which always declare them)
  and re-collecting only for deps-free `$C` brought it to **+9 %**, and B's `$C` is the fastest
  computed read of the three computed-capable directions.
* **All six directions are viable on the macro bench** (updates within ~14 %, retained heap within
  ~8 %), so the decision should be made on ergonomics, capabilities and dependency policy rather than
  on performance.
* **The real app agrees.** `apps/repl` compiled against each backend passes all 10 app checks with zero
  console errors, including the two asynchronous paths (a `Loop` re-render after a `setTimeout`, and a
  **Promise used directly as a JSX child**). Bundle cost: B **+10.6 %** (54.4 kB vs 49.2 kB),
  C **+30.8 %** (64.3 kB), on the `index.js` entry.
* **Both B and C are verified drop-in replacements** for `@jsx6/signal` (see `DROPIN.md`): all **42**
  exported names present with matching types, **zero** behavioural regressions on every contract case
  the shipped package passes, `tsc` (declaration emit **and** `checkJs`) clean, both bundles build, and
  the untouched 30-test suite is green. B adds nothing to the dependency graph; C adds alien-signals
  (the one respect in which it is a drop-in *API* but not a drop-in *package*).
* **Which direction needs a bridge** (`USAGE-AND-SIZE.md` §3): C needs **none** (its signals are alien
  nodes, so alien tracks bare reads and `toAlien()` is a zero-allocation lookup). A/E/F need a bridge
  for every crossing, cost ~1.8 kB gzip of alien even when the app never interops, and their `batch()`
  does **not** make a mixed two-write update atomic. The baseline and B have no bridge at all, so an
  alien node handed to `$F` is silently treated as a static value, and an alien `computed` used where
  JSX expects a signal renders as a function.

## Deliberate scope limits

* **No existing code was edited** except one line in `.oxfmtrc.json` (`experiments` added to
  `ignorePatterns`) so the repo's `oxfmt --check` step stays green without reformatting the vendored
  third-party files. `bun x oxfmt --check` passes on the whole tree, and `bun run test` is green.
* **`apps/repl`'s build config is untouched**: `d-dual-surface/app-build.js` imports the app's own
  `esbDef` from `src_build/buildScript.js` and calls esbuild directly with an alias plugin, writing to
  `d-dual-surface/.tmp/app-build/<backend>/` (a gitignored scratch directory). Graduating this into a
  real workflow would mean adding the plugin to `apps/repl/src_build/build.js`.
* **The copied cores keep their tests byte-identical** to `libs/signal`'s (SHA-256 verified), so a
  green copied suite is meaningful evidence.
* **The app smoke is not part of `bun run check`** — it is an experiment runner. It is also not a
  substitute for a human clicking through the page: it asserts rendering, reactivity and teardown, not
  interaction. That is what `--serve` is for.
* **Graduating a direction is a separate change**: it means moving code into `libs/signal`, adding the
  dependency to the root `catalog` (if any), re-running `bun run check --build`, and deleting this
  directory's scaffolding per the decision protocol in the portfolio plan.