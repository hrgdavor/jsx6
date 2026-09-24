# @jsx6/signal-alien

The [`@jsx6/signal`](../signal/README.md) contract implemented on top of
[alien-signals](https://github.com/stackblitz/alien-signals), plus two-way interop between the two.

**Who this is for.** Projects that want alien-signals itself — its `computed`/`effect`/`effectScope`
graph, its batching, its ecosystem — and still want the jsx6 signal API they already write. If all you
want is `computed` for jsx6 signals, use [`@jsx6/signal`](../signal/README.md) instead: it has the same
`$C`/`$CE`/`batch`/`dispose` surface, **no dependency**, and costs ~2 kB gzip less. This package only
pays for itself when the app actually uses alien's graph.

It is a **drop-in replacement**: same exported names, same behaviour, same emitted types. See
[Drop-in verification](#drop-in-verification).

```bash
npm install @jsx6/signal-alien alien-signals
```

## What comes from where

Two layers, and it matters which is which when reading the size table or debugging:

| part | who provides it | files |
|---|---|---|
| storage of every value, the propagation graph, dependency tracking, `computed` caching, batching | **alien-signals** | the dependency itself |
| the callable signal contract: `$sig()` / `$sig(v)`, `===` change detection, the listener `Set`, `Symbol.for('signalSubscribe')`/`signalTrigger`, `label`/`name`/devtools affordances, Promise/Observable interop | jsx6 (this package) | `src/signal.js` |
| `$S`/`$F` with union dependencies, and `$C`/`$CE`/`batch`/`dispose` as a thin surface over `alien.computed` + a root `alien.effect` that pushes into the jsx6 listener set | jsx6 (this package) | `src/computed.js`, `index.js` |
| `observe`/`observeNow`/`subscribe`, `$State`, `mergeValue`, `makeContext` | jsx6 (this package), unchanged from `@jsx6/signal` | `src/observe.js`, `src/state.js`, `src/makeContext.js` |
| `toAlien` / `toSignal` bridges and the alien-aware `observe`/`isObservable` overrides | jsx6 (this package) | `src/compat.js` |
| the one import of the dependency | — | `src/alien.js` |

### The branding nuance (worth knowing)

`signal()` and `$C()` return **jsx6 wrappers**, not alien nodes. Alien's `isSignal()`/`isComputed()`
are name-based brand checks, so they return `false` for these wrappers — deliberately, because the
wrappers carry the whole jsx6 contract (write support, `===` guard, labels, the symbol protocol) that a
raw alien node does not have.

What that means in practice:

```js
import { signal, $C, toAlien, isAlienSignal, alien } from '@jsx6/signal-alien'

const $a = signal(1)
isAlienSignal($a)          // false — it is a jsx6 wrapper
isAlienSignal(toAlien($a)) // true  — toAlien() returns the backing alien node (cached, no allocation)

// ...yet alien's own graph tracks a bare jsx6 read with no bridge at all:
const c = alien.computed(() => $a() * 10)
c()      // 10
$a(2)
c()      // 20
```

The last part is the reason this package exists: because the value really does live in an
`alien.signal`, alien's tracking sees a plain read. There is no listener bridge for this package's own
signals — `toAlien()` is a property lookup, and only *foreign* signals (another copy of
`@jsx6/signal`, a duck-typed fake) need the listener-based bridge in `src/compat.js`.

### Inspecting in the dev console

Identical to `@jsx6/signal`, including the console inspection: `installConsoleInspection()` (see
`src/debug.js`) wraps the console methods so `console.log($sig)` logs a described object with the value —
no call-site change, nothing to enable, no cost on any signal path, and opt-in because it patches global
console methods. Every signal also carries the non-enumerable `value` getter, so
`console.log($count.value)` always works with no mechanism at all. The proxy route (a `Proxy` per handle,
so DevTools' own formatters could read a signal) is not here either: measured ~13× on reads — see
`changes.md`. `bun experiments/signal-inspect/serve.js` demos all of it on both cores. `$State` is a proxy
— inspect a field with `$s.field.value`, or print the state (`String($s)` gives its JSON form).

## Usage

### As a drop-in core

```js
// before
import { signal, $S, $F, $State, observeNow } from '@jsx6/signal'
// after — nothing else changes
import { signal, $S, $F, $State, observeNow } from '@jsx6/signal-alien'
```

The same swap works at the bundler level for an existing app (`@jsx6/signal` →
`@jsx6/signal-alien`); that is exactly what the experiment runner does to `apps/repl`, which passes
every check on this core.

### The computed axis

```js
import { $C, $CE, batch, dispose, $State } from '@jsx6/signal-alien'

const $c = $C(() => $a() + $b())   // alien.computed: lazy, memoized, auto-tracking
$CE(() => $a() * 2)                // eager: a root alien.effect keeps it hot
batch(() => { $a(1); $b(2) })      // alien startBatch/endBatch: one settled value
dispose($c)                        // stop the push effect and release dep links
```

`$C` follows alien's rules, not the native core's: it is **pull-based and read-only** (writing is a
no-op), it recomputes lazily on read, and `$CE` is the only eager form.

### Interop

```js
import { alien, toAlien, toSignal, isAlienNode, observeNow, $F } from '@jsx6/signal-alien'

// alien -> jsx6: a mirror signal that behaves like any other jsx6 signal
const $mirror = toSignal(alien.computed(() => count()))
observeNow($mirror, v => el.textContent = v)

// jsx6 -> alien: hand alien the real node behind a jsx6 signal
alien.effect(() => console.log(toAlien($mirror)()))
// or, since this core is alien-backed, just read it:
alien.effect(() => console.log($mirror()))   // tracked, no bridge

// jsx6 derived signals accept alien values as dependencies
const $doubled = $F(v => v * 2, alien.signal(1))
```

Because `observe`/`observeNow`/`subscribe`/`isObservable` are alien-aware here, an alien `computed`
works in a JSX position — `{$computed}` renders its value rather than a function. That is the most
visible difference from using alien next to the plain `@jsx6/signal` core, where an alien node in a
JSX position is treated as a static value.

## Bundle size

Measured with esbuild (bundle, esm, esnext, minify) and gzipped, by
`bun experiments/signal-directions/harness/size-packages.js`. The entry uses the core API plus the
computed axis (`$S`, `$F`, `$State`, `observeNow`, `$C`, `$CE`, `batch`, `dispose`).

| bundle | plain | minified | gzipped |
|---|---|---|---|
| `@jsx6/signal` (**B** — same core, no dependency) | 12.3 kB | 4.8 kB | **2.2 kB** |
| **`@jsx6/signal-alien` (this package, total)** | **27.9 kB** | **11.0 kB** | **4.3 kB** |
| ↳ of which alien-signals (full API surface) | 12.5 kB | 4.9 kB | 1.8 kB |
| ↳ of which alien-signals (`signal`+`computed`+`effect` only) | 11.5 kB | 4.4 kB | 1.7 kB |
| ↳ of which jsx6-side code (difference) | 15.4 kB | 6.1 kB | 2.5 kB |
| frozen `@jsx6/signal@1.8.18` (control, no computed) | 6.4 kB | 2.4 kB | 1.2 kB |

**Attribution.** Of this package's 4.3 kB gzip, **alien-signals is 1.8 kB** and the jsx6-side code is
**≈2.5 kB** — which is essentially the whole of B (2.2 kB): the same computed/batching/tracking surface,
the same `observe`/`$State`/`makeContext`, plus the small compat layer. The "jsx6-side" figure is a
difference of two bundles, so treat it as ±0.2 kB rather than an exact split.

**Compared with B:** `+2.0 kB gzip` for the same feature set — you are paying for alien-signals, not for
jsx6 code. Of the 4.3 kB, alien-signals accounts for 1.8 kB (1.7 kB if only `signal`, `computed` and
`effect` are reachable) and this package's own code for ≈2.5 kB, which is B's 2.2 kB plus the interop
layer.

### In a real application

The whole `apps/repl` entry, built unmodified against each core and booted headlessly
(`bun experiments/signal-directions/d-dual-surface/app-compare.js`):

| core | index.js plain | minified | gzipped | vs the frozen 1.8.18 control | app checks |
|---|---|---|---|---|---|
| `@jsx6/signal` (B) | 55.0 kB | 26.8 kB | 9.5 kB | +11.6 % | 10 / 10 |
| `@jsx6/signal-alien` (this package) | 70.6 kB | 35.0 kB | 11.8 kB | **+43.2 %** | 10 / 10 |
| frozen 1.8.18 control | 49.3 kB | 24.2 kB | 8.5 kB | — | 10 / 10 |

The app pays **+8.2 kB minified** over the shipped core, against +6.3 kB in the isolated bundle: the
entry re-exports alien's API surface (`alien`) and the interop layer, and an app that imports the entry
keeps that reachable. An app that never interops could avoid it with a separate `interop` subpath entry
— a possible future refinement, not something this package does today.

## Drop-in verification

"Drop-in" is checked, not claimed (`bun experiments/signal-directions/harness/dropin.js`):

* **export surface** — every name `@jsx6/signal` exports (46) is present with the same `typeof`, and
  this package adds 7 (`alien`, `toAlien`, `toSignal`, `isAlienSignal`, `isAlienComputed`,
  `isAlienNode`, `stateSymbol`);
* **behaviour** — zero regressions on every contract case the shipped package passes, plus the 10
  additional cases only this core can satisfy (its native auto-tracking path, alien batching, and the
  whole interop matrix);
* **types** — `tsc` with declaration emit and `checkJs` is clean, and the emitted `dist/index.d.ts`
  loses no declaration from the shipped package's;
* **bundles** — `esm` and `cjs` builds succeed;
* **tests** — the shipped package's own 7 test files / 30 tests are copied **byte-identically** into
  this package and pass here, alongside 31 new tests for the computed axis and the interop layer
  (61 tests total);
* **the real app** — the unmodified `apps/repl` entry boots and passes all 10 checks on this core with
  zero console errors.

The one respect in which this is not a drop-in *package*: it adds a runtime dependency, and the raw
`index.js` entry therefore contains a bare `alien-signals` specifier that a browser cannot resolve
without an import map. The bundled `esm`/`cjs` entries inline it; use those (or your bundler) for the
browser.

## Cost and caveats

* **Micro hot paths.** A raw `write + read` loop costs about **+90 %** against the native core, because
  a read with an active subscriber goes through the alien node. On the long-lived-component macro
  benchmark (300 components, 3000 writes, unmount) the same code is within ~14 % of the native core.
  Measure your own workload; the numbers above are from
  [experiments/signal-directions/RESULTS.md](../../experiments/signal-directions/RESULTS.md).
* **Alien's semantics for `$C`.** Pull-based, read-only, no dependency list needed, and
  `computed` values are cached until invalidated — a cold computed is not recomputed by a write.
* **Batching only inside `batch()`.** `$State` mutations batch through alien's `startBatch`/`endBatch`;
  two plain writes outside `batch()` still notify twice, exactly as in the native core.
* **Versions.** alien-signals is pinned through the workspace catalog (`catalog:`), currently `^3.2.1`.
  A major bump is a behavioural change for this package and needs the copied test suite plus the
  drop-in runner re-run.
* **Lockstep.** This package is released together with `@jsx6/signal`, so consumers can switch cores
  without their types and APIs drifting apart (see `MODULE_VERSIONING.md`).