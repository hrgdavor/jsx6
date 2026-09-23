# Developer Guide

This document provides instructions for developers working on the JSX6 monorepo.

## The local gate (there is no CI)

This project deliberately has **no CI/CD** — no GitHub Actions, no build server, no remote gate of
any kind (`plan/improvement-plan.md`, decision D1). Everything is verified on your machine, so the
local gate is the only gate there is:

```bash
bun run check        # full gate — required before committing and before `bun pub`
bun run check:fast   # tests + JSDoc type check only
bun run test         # tests only, discovered across every package
```

**`bun run check` must pass before `bun pub`. There is no CI; this command is the only gate.**

An optional **local** pre-commit hook runs the fast subset for you (it is not CI and nothing runs it
on a server):

```bash
git config core.hooksPath .githooks
```

The full gate (`scripts/verify.js`) runs, in order:

| Step | What it does |
|---|---|
| tests | `bun test` in **every** package that has tests (discovered by glob, not hardcoded) |
| declaration emit | `tsc -p tsconfig.json` per lib, so `dist/*.d.ts` is always producible |
| type check | `tsc --noEmit` per lib with `checkJs` on (catches undefined-identifier bugs) |
| eslint | library/tool/script sources, including the custom `jsx6/signal-dependencies` rule |
| dependency versions | `scripts/check-versions.js` — every catalog-managed dependency must use `catalog:` |
| docs sync | `scripts/check-docs.js` — the committed `docs/demistify/` site matches a build from `apps/repl/static/` (single source of truth) |
| manifest audit | `scripts/check-manifests.js` — declared entry points exist, are covered by `files`, resolve to real dependencies, match `MODULE_VERSIONING.md`, ship no test files, and are actually present in `npm pack --dry-run` output |

Useful flags: `--quick`, `--tests-only`, `--build` (build every lib bundle first, so the tarball
assertions become strict, and rebuild-compare the docs site), `--no-pack`, `--no-lint`, `--no-types`,
`--no-declarations`, `--no-versions`, `--no-docs`, `--no-manifests`, and `--require-built` (every
declared build output must already exist — used by the publish path).

The individual checks can also be run directly:

```bash
bun run scripts/check-versions.js
bun run scripts/check-manifests.js
bun run scripts/check-manifests.js --no-pack     # skip the npm-pack tarball assertion
bun run scripts/check-docs.js                    # docs/demistify vs apps/repl/static
bun run docs:build                               # regenerate the tutorial site
```

**Lint scope:** the gate lints `libs/`, `tools/` and `scripts/`. `apps/` is deliberately excluded:
JSX components are consumed by the JSX transform, so `no-unused-vars` reports them all as unused
(~40 false positives today), and the tutorial sources contain intentional irregular whitespace inside
example text that a linter must not "fix". The apps are verified by their own builds and by the docs
sync check instead. `bun run lint` (plain `eslint .`) remains available if you want the full report.

## Building Modules

Most modules in `libs/` use `esbuild` for bundling and `tsc` for type declaration generation. Run
these from the package directory (or via `bun --filter`):

### esbuild (Bundling)
To build ESM and CJS bundles:
```bash
bun run build
bun run build-cjs
```

### tsc (Type Declarations)
We use JSDoc for typing (`checkJs` is enabled in every lib's `tsconfig.json`). To generate `.d.ts`
files for consumers:
```bash
bun run tsc
```
*Note: always run TypeScript through Bun (`bun run tsc` / `bun x tsc`) so the workspace copy is used
instead of a globally installed `tsc`, which on Windows may resolve to the unrelated system
`tsc.exe`.*

---

## Versioning (Bump)

We manage several modules in lockstep versioning. To update all lockstep modules to a new version, use the `bump` script from the root:

```bash
bun run bump <new-version>
```
Example: `bun run bump 1.8.19`

This script will:
1. Update `package.json` for all modules listed in `scripts/versions.json`.
2. Update the `Current Version` in `MODULE_VERSIONING.md`.
3. Update `jsr.json` in any bumped package that has one, so the JSR version cannot drift.

---

## Publishing (Pub)

We use a centralized publish script to ensure all `workspace:*` and `catalog:` dependencies are resolved correctly before they reach the NPM registry.

### Unified Publish Process
The script `scripts/publish.js` builds and tests each targeted package, then runs the **full local
verification gate** with `--require-built` and aborts if anything fails. It resolves `workspace:*` /
`catalog:` versions, writes the resolved manifest, publishes, and restores the original manifest —
including from process-exit handlers, so an interrupted run cannot leave resolved versions behind in
your working tree.

**Publish the lockstep group (default):**
```bash
bun pub
```

**Publish individual packages:**
```bash
bun pub libs/popover
```

**Dry Run (Simulation):**
```bash
bun pub --dry-run
# or
bun pub libs/popover --dry-run
```

**Note:** The script relies on your active `npm login` session (no manual OTP prompts). The `--manual-replace` and `--public` flags are automatically included when using the `bun pub` shortcut from the root.

---

## Install layout

`bunfig.toml` pins `[install] linker = "hoisted"`. This is deliberate: the toolchain (ESLint and its
own dependencies, Prettier, the `tsc`/`eslint` `.bin` shims, and `npm` itself inside
`scripts/publish.js`) expects classic `node_modules` resolution. Bun's isolated linker keeps
transitive dependencies inside `node_modules/.bun`, which Node-based shims cannot resolve.

`bun.lock` is committed; per-package `package-lock.json` / `pnpm-lock.yaml` files are leftovers from
before the Bun migration and should not come back.

---

## Troubleshooting

### Windows ENOENT Errors
If you encounter `ENOENT` when spawning `npm` or `tsc` in scripts, ensure you are using `shell: true` in your spawn options. The `publish.js` script is already configured for this.

### TypeScript Resolution
If `tsc` is not recognized, run `bun install` at the root to link the workspace dependencies.

### ESLint cannot find its own modules
If ESLint fails with `Cannot find module '@eslint/eslintrc'`, your `node_modules` was installed with
Bun's isolated linker. Re-run `bun install` (with the committed `bunfig.toml` in place) to get the
hoisted layout. `scripts/verify.js` also runs ESLint through Bun rather than through the `.bin` shim
so the gate works either way.

---

## Security note: the REPL executes arbitrary code on purpose

`apps/repl` is an in-browser REPL: it `eval`s code typed by the user and loads packages from unpkg on
demand (`apps/repl/src/runner/`). The tutorial frames that code in an iframe with
`sandbox="allow-same-origin allow-scripts"`.

That combination is the one MDN warns lets framed code escape its sandbox. It is deliberate here:
the parent has to reach into `contentWindow.document` to reload and resize the frame, and an opaque
origin (dropping `allow-same-origin`) would break that, so the documented decision
(`plan/improvement-plan.md` P4-12) is to **keep the sandbox and serve the tutorial from a dedicated
origin**, rather than to pretend the frame is a security boundary it is not.

Practical consequences:
- Never host the tutorial on the same origin as anything that holds credentials or data you care
  about.
- The loader still uses a synchronous `XMLHttpRequest`, which blocks the UI thread. Making it async
  changes the public contract of `require()` inside the REPL and is tracked as remaining work.