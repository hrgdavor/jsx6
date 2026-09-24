# The alien-signals core, and moving between the two

`@jsx6/signal` is not the only implementation of this contract in the repository. The computed-signals
effort produced a second, independent one:

**[`@jsx6/signal-alien`](../../../signal-alien/README.md)** — the same public API, implemented on top of
[alien-signals](https://github.com/stackblitz/alien-signals): alien owns the values and the propagation
graph, and a thin jsx6 layer provides the callable signal contract, the `===` change guard, the
`Symbol.for` protocol, labels, `$State` and the interop helpers.

It is not a replacement for this package and it is not the reason this package has `$C`. It exists for
projects that want alien-signals **itself** — its graph, its ecosystem, its `effect`/`effectScope` — and
still want to write jsx6 signals. If all you want is `computed`, this package provides it with no
dependency and 2 kB gzip less:

| | `@jsx6/signal` (this package) | `@jsx6/signal-alien` |
| --- | --- | --- |
| `computed` | native, in this core | alien-signals' `computed` |
| runtime dependencies | **none** | `alien-signals` |
| gzipped, core + computed axis | **2.0 kB** | 4.1 kB (≈2.3 kB of it is jsx6-side code, 1.8 kB alien) |
| drop-in replacement for `@jsx6/signal` | — | **yes**, verified ([DROPIN.md](../../../../experiments/signal-directions/DROPIN.md)) |
| alien nodes as dependencies | not without a bridge | native |
| `$C` laziness / `$CE` eagerness | both | both (`$CE` is a push effect over alien's computed) |
| released | lockstep 1.8.18 | lockstep 1.8.18 |

Both are in the same lockstep group on purpose: consumers switch per project, so their APIs and types
must move together (`MODULE_VERSIONING.md`).

## Switching

Because the surface is identical, a switch is an import change — or a bundler alias for an existing
application:

```js
import { signal, $S, $F, $State, observeNow } from '@jsx6/signal-alien'
```

The dependency that makes it different is declared in its manifest, and pinned through the workspace
catalog:

[../../../signal-alien/package.json](../../../signal-alien/package.json#region:dependencies)

```json
{
  "dependencies": {
    "alien-signals": "catalog:"
  }
}
```

## Interop, in both directions

The reason to choose the alien core is usually to use alien's own API next to jsx6's. Two properties
make that pleasant, and one rule keeps it honest.

**alien → jsx6**: `toSignal(node)` mirrors an alien node as a jsx6 signal, which is what `$S`/`$F` need
if you want to derive from an alien value.

**jsx6 → alien**: `toAlien($sig)` returns the alien node behind a signal of that package. For its own
signals it is a property lookup, not a listener bridge.

**The rule**: tracking follows the getter. A read is tracked only if the graph that is computing owns
the getter being called.

* `@jsx6/signal-alien`'s values **live** in alien signals, so a bare jsx6 read inside an alien
  `computed` or `effect` registers a dependency natively — no bridge;
* `@jsx6/signal`'s values live in this package's own closure, so an alien computation reading one sees
  a plain function call and learns nothing. That is why the interop directions that keep this core
  (`a-compat`, `e-alien-native`, `f-bridge-hybrid` in the experiments) must bridge with `toAlien`, and
  why the bridge is listener-based there rather than free.

The measured consequences — including the two silent failure modes when an alien node meets jsx6 code
without a bridge — are in
[USAGE-AND-SIZE.md](../../../../experiments/signal-directions/USAGE-AND-SIZE.md), and the per-package
tests that pin the behaviour are in `libs/signal-alien/src/interop.test.js`.

## When to pick which

* **`@jsx6/signal`** — the default. You want `computed` (or batching, or disposal), you care about
  bundle size, or you want the eager model with no new dependency. This is also the core the rest of
  the repository builds against.
* **`@jsx6/signal-alien`** — you are already using alien-signals, or you specifically want its
  `effect`/`effectScope` and its graph semantics, and you want to keep writing jsx6 signals and JSX with
  them. Accept ~2 kB gzip and one dependency in exchange for native interop.
* **both** — feasible in one repository, because the packages are versioned in lockstep and each signal
  is only "foreign" to the other graph, never broken by it. The interop helpers exist precisely for the
  boundary: see `toAlien` / `toSignal` above.