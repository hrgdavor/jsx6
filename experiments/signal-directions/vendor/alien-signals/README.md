# vendored `alien-signals@3.2.1` (MIT)

This directory is a **verbatim copy of the published npm tarball's ESM build**, vendored so that the
direction experiments can run:

* without adding a dependency to the monorepo (no root `package.json` / `bun.lock` change),
* without touching any existing source file,
* reproducibly, on any machine that has this repo checked out.

| File | Source inside `alien-signals@3.2.1` |
|---|---|
| `index.mjs`, `system.mjs` | `esm/` (imports are `./system.mjs`, so the pair is self-contained) |
| `index.d.ts`, `system.d.ts` | `types/` (not used at runtime; kept for reference/typing) |
| `LICENSE` | verbatim MIT licence of the upstream project |
| `upstream-package.json` | the upstream `package.json`, kept to document version/exports/licence |

Upstream: <https://github.com/stackblitz/alien-signals> · <https://www.npmjs.com/package/alien-signals>
Version: **3.2.1** (published 2026-05-14) · Licence: MIT · Zero runtime dependencies.

**Do not edit these files.** If a direction needs different behaviour, wrap it — that is part of what
the comparison measures.

Replacing this directory with a real dependency (root `catalog` + `dependencies`) is a graduating
step: it happens only when a direction is chosen, and it is described in
[plan/signal-directions-portfolio.md](../../../plan/signal-directions-portfolio.md) §7 and §10.