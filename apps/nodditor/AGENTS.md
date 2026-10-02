# AGENTS.md — apps/nodditor

The blocky node editor. Directory-scoped notes only — the stack rules are in
[docs/stack/agent-rules.md](../../docs/stack/agent-rules.md).

| topic | load |
| --- | --- |
| full reference: API, block/connector DOM contract, line layers, styling, testing | [README.md](README.md) |
| host instructions, in order, with the traps | [doc/getting-started.md](doc/getting-started.md) |
| the app's documentation index (and how its examples run) | [doc/README.md](doc/README.md) |
| feeding a diagram in: duplicate-line error, `loadLines` vs `addConnectorFromTo` | [doc/feeding-data.md](doc/feeding-data.md) |
| `--ne-*` styling contract | [doc/styling-migration.md](doc/styling-migration.md) |

## Verifying a change here

```sh
cd apps/nodditor
bun test                       # unit tests; happy-dom globals come from test/setup.js
bun run build                  # production bundle + static copy (prints BUILD SUCCESS)
node smoke/p3.run.mjs          # script-style suites: p1/p2/p3, seam, essential, boot
node doc/getting-started.run.mjs   # the runnable doc example
```

The root gate type-checks and lints `libs/`, `tools/` and `scripts/` only — this app is verified by its
own build, `bun test` and the demo. `bun test apps/nodditor` from the repository root does **not** work:
Bun reads `bunfig.toml` from the cwd, so the JSX transform would not be configured.

## Conventions that bite

- `src/runtime-default.js` is the **only** module allowed to import `@jsx6/*`; everything else goes
  through `backend.current` (asserted by [test/runtime.test.js](test/runtime.test.js) and the `SEAM-1`
  smoke check).
- Doc examples are `doc/<page>.example.jsx` + `doc/<page>.run.mjs` — never `*.test.*`; the runner
  installs the DOM globals, the library stylesheet and the JSX bundle before importing.
- Bundles are generated into `doc/*.bundle.mjs` / `smoke/*.bundle.mjs`; the `doc/` ones are gitignored and
  both are excluded from Oxfmt by [.oxfmtrc.json](.oxfmtrc.json) (a nested config replaces the root one —
  re-list what you need).
- Fenced samples in `doc/` are injected from real files: `bun run docs:inject` /
  `bun run docs:inject:check` from this package or the repository root.