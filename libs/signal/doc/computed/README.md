# Computed signals in `@jsx6/signal`

This documentation set explains the **computed signals effort**: what `@jsx6/signal` gained, why the
implementation looks the way it does, and which existing behaviour had to be preserved or repaired to
get there.

It is written for two readers:

* **users** of the package who want `computed`, batching or explicit dependency release — start with
  [usage.md](./usage.md);
* **maintainers** who need to change `src/` without breaking the eager core every existing application
  depends on — read [dependencies.md](./dependencies.md), [implementation.md](./implementation.md) and
  [changes.md](./changes.md).

Every code sample below is **injected from a real file** by
[`@hrg/inject-examples`](https://github.com/hrgdavor/inject-examples) (`bunx @hrg/inject-examples`), so
none of it can drift from what the tests run: the excerpts come from `src/` itself, and the usage
samples come from
[`examples/`](./examples), which the package's own `bun test` executes.

| page | what it covers |
| --- | --- |
| [usage.md](./usage.md) | the four additions in use: `$C`, `$CE`, `batch()`, `dispose()` |
| [dependencies.md](./dependencies.md) | how dependencies are found — auto-tracking, union with the declared list, the `$State` aggregate, and the one thing that cannot be tracked |
| [implementation.md](./implementation.md) | the internals: the read hook, the collector, invalidation, settling, ordering, batching |
| [changes.md](./changes.md) | what changed file by file, what deliberately did not, the cost, and what was rejected |
| [alien-core.md](./alien-core.md) | the sibling implementation on alien-signals, and how to move between the two |

## The one-paragraph summary

`@jsx6/signal` keeps its original design: eager, synchronous, immediate propagation with `===` change
detection and manual dependency lists — the model that suits long-lived components. On top of it, four
things were **added**, not substituted:

1. `$C` — a lazy, memoized computed that discovers its dependencies by reading them;
2. `$CE` — the same, but eager, for code that wants auto-tracking with the old propagation timing;
3. `batch()` — an explicit, opt-in postponement so several writes settle once with no intermediate
   value visible;
4. `dispose()` — release a computed's dependency subscriptions.

`$S` and `$F` keep their signatures and their eager behaviour; their dependency list is now a **union**
of the declared signals and whatever the callback reads. The package still has **no dependencies**:

[../../package.json](../../package.json#region:name,dependencies)

```json
{
  "name": "@jsx6/signal",
  "dependencies": {}
}
```

## A first example

[examples/basic.js](./examples/basic.js#region:demo)

```js
const $a = signal(1)
const $b = signal(2)

let evaluations = 0
const $sum = $C(() => {
  evaluations++
  return $a() + $b()
})

// Nothing has run yet: a computed is lazy.
assert.equal(evaluations, 0)

$sum() // 3 — evaluated on the first read
$sum() // 3 — and then served from cache
assert.equal(evaluations, 1)

$a(10)
assert.equal($sum(), 12) // recomputed because a dependency changed
```

Read [usage.md](./usage.md) for `$CE`, `batch()` and `dispose()`, and
[changes.md](./changes.md) for the numbers behind the design (including the +1.0 kB gzip the whole
computed axis costs).

## Keeping these pages true

The samples are injected, so a page cannot quietly disagree with the code:

```bash
bun run docs:inject         # rewrite every block from its source file
bun run docs:inject:check    # fail if any block is stale
```

Both run [`@hrg/inject-examples`](https://github.com/hrgdavor/inject-examples) through `bunx`, so the
tool is not a dependency of this repository. Two consequences worth knowing:

* the **usage** samples come from [`examples/`](./examples), which
  [`examples.test.js`](./examples.test.js) executes as part of the package's own `bun test` — a wrong
  explanation fails the suite;
* the **implementation** excerpts come from `src/` by region name (a declaration name, or an explicit
  `#region` comment where a declaration would be ambiguous), so a refactor that renames or moves code
  is caught by `docs:inject:check` rather than by a reader.

`docs:inject:check` is deliberately **not** wired into `bun run check` yet: it would make the repository
gate depend on a tool fetched at run time. Adding it later is one step in `scripts/verify.js`.