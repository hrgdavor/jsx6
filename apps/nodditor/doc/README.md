# `@jsx6/nodditor` documentation

The package reference is [../README.md](../README.md) — it is the API, the block/connector DOM contract,
the line-layer interface, the styling variables and the testing notes. This folder holds the guides that
are too long or too specialised for it.

| page | what it is for |
| --- | --- |
| [getting-started.md](./getting-started.md) | the ordered host path: install → stylesheet → editor → blocks → lines → persistence, with the traps |
| [feeding-data.md](./feeding-data.md) | feeding a diagram in from your own data: the duplicate-line error, `loadLines` vs `addConnectorFromTo`, `dedupeLines()`/`fillPage()` |
| [zoom-controls.md](./zoom-controls.md) | the built-in zoom UI, and the public zoom API for building your own |
| [styling-migration.md](./styling-migration.md) | the `--ne-*` custom properties that replaced inline styles, and the theming contract for both line layers |
| [../static/vanilla/README.md](../static/vanilla/README.md) | the reference host with no JSX, no signals and no framework — the smallest thing that is usable |

## Running an example

Each page whose sample is a runnable file has an `<page>.example.jsx` (or `.js`) next to it and a
`<page>.run.mjs` runner. The runner does what a test cannot: it boots happy-dom, installs the library
stylesheet, bundles the example with this app's esbuild settings, and only then imports it — the editor
extends `HTMLElement` when its module is evaluated.

```sh
cd apps/nodditor
node doc/getting-started.run.mjs   # or: bun run docs:getting-started
node doc/feeding-data.run.mjs      # or: bun run docs:feeding-data
node doc/zoom-controls.run.mjs     # or: bun run docs:example
```

The example files are deliberately **not** named `*.test.*`: `bun test` discovers that pattern across the
whole tree and would run them without the globals they need. `bun test` in this package covers
[../test/](../test/); the script-style suites live in [../smoke/](../smoke/).

## Keeping the samples true

The code fences on these pages are injected from the real files by
[`@hrg/inject-examples`](https://github.com/hrgdavor/inject-examples):

```sh
bun run docs:inject         # rewrite the fenced blocks from their sources
bun run docs:inject:check   # fail when a block has drifted
```

A marker line is a Markdown link whose label equals its target, with a `#region:<name>` fragment; the
fenced block immediately below it is replaced, byte for byte. Source files carry the matching
`// #region <name>` … `// #endregion <name>` comments.