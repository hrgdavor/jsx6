# AGENTS.md — libs/dom-observer

Shared `IntersectionObserver` / `ResizeObserver` for the jsx6 stack. Directory-scoped notes only.

| topic | load |
| --- | --- |
| what it is for, where it is used, quick look | [README.md](README.md) |
| full instructions: API, sharing keys, lifecycle, limits, testing a consumer | [doc/usage.md](doc/usage.md) |
| the docs index and the runnable example | [doc/README.md](doc/README.md) |

## Facts that change how you edit or test here

- The public surface is `observeIntersect`, `observeResize`, `observeShowHide`, `observeInit` from
  [index.js](index.js). `makeObserverHandler` is internal.
- Importing the package constructs the shared `ResizeObserver` at module scope, so
  `globalThis.ResizeObserver` must exist **before** the import; `IntersectionObserver` is created lazily.
  happy-dom 14 has no `IntersectionObserver` and its `ResizeObserver` never fires — stub both.
- The package has **no test files**: `"test": "node --test"` is dead, and the gate skips packages with no
  `*.test.*`. The documentation example ([doc/usage.example.mjs](doc/usage.example.mjs)) is the executable
  specification — keep it passing:
  `node doc/usage.example.mjs` (or `bun run docs:example`).
- Do not add a `*.test.js` under `src/`: `files` ships `src` (no test exclusion), so it would be published
  and `scripts/check-manifests.js` would fail on the tarball.
- `doc/` is not in `files`, so documentation does not ship.
- Fenced samples in `doc/usage.md` are injected from real files:
  `bun run docs:inject` / `bun run docs:inject:check`.