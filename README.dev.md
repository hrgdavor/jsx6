# Developer Guide

This document provides instructions for developers working on the JSX6 monorepo.

## Toolchain: Bun workspaces (Rush is gone)

The repository is a single **Bun** workspace: `workspaces` + `catalog:` in the root
[`package.json`](package.json), one committed `bun.lock`, and no second package manager. Imports
between packages use `workspace:*`; shared external dependencies are declared once in the root
`catalog` and referenced as `catalog:`.

Requires **Bun 1.3.14 or newer**, declared in `packageManager` / `engines` in the root
`package.json`. The floor is not cosmetic: this repo uses Bun's singular `catalog` key, and an older
Bun can silently ignore it and resolve a different dependency tree than `bun.lock` was built from.

```bash
bun install                    # from the repository root
bun install --frozen-lockfile  # what a clean checkout / verification should use
```

If you know Rush, this is the translation table:

| Rush | Now |
|---|---|
| `rush update` | `bun install` (`--frozen-lockfile` for the strict form) |
| `rush build` | `bun run check --build`, or `bun run build` inside a package |
| `rush test` | `bun run test` |
| `rush check` | `bun run check` — but note it is **not** the same check: the workspace-integrity step fails on *version drift between manifests*, which is the part of `rush check` that used to catch mismatched pins |
| `rush change`, `rush version --bump` | `bun run bump <version>` (`scripts/versions.js`) |
| `rush publish` | `bun pub` (`scripts/publish.js`) |

`npm` is still used for exactly one thing: `npm pack --dry-run --json` inside the manifest audit,
because it is the reference packer and the only one with machine-readable output. It is a dev-only
tool, never a way to install — `scripts/check-workspace.js` fails the gate if a
`package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` reappears.

---

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
| manifest audit | `scripts/check-manifests.js` — declared entry points exist, are covered by `files`, resolve to real dependencies, match `MODULE_VERSIONING.md` **and `scripts/versions.json`**, ship no test files, and are actually present in `npm pack --dry-run` output |
| workspace integrity | `scripts/check-workspace.js` — no Rush artifacts, exactly one lockfile, internal deps are `workspace:*`, and no dependency is pinned to two different versions across the workspace |

Useful flags: `--quick`, `--tests-only`, `--build` (build every lib bundle first, so the tarball
assertions become strict, and rebuild-compare the docs site), `--no-pack`, `--no-lint`, `--no-types`,
`--no-declarations`, `--no-versions`, `--no-docs`, `--no-manifests`, `--no-workspace`, and
`--require-built` (every declared build output must already exist — used by the publish path).

The individual checks can also be run directly:

```bash
bun run scripts/check-versions.js
bun run scripts/check-manifests.js
bun run scripts/check-manifests.js --no-pack     # skip the npm-pack tarball assertion
bun run scripts/check-workspace.js               # single-package-manager guard rail
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

We manage the core modules in lockstep versioning, and the rest independently; `scripts/versions.json`
is the record of both groups.

```bash
bun run bump                              # show the lockstep version and every standalone package
bun run bump 1.8.19                       # bump the lockstep group
bun run bump --pkg @jsx6/popover 1.0.2    # bump one standalone package
bun run bump --standalone 2.1.0           # bump every standalone package
```

A bump:
1. updates `package.json` for every targeted module;
2. updates the `Current Version` in `MODULE_VERSIONING.md` (lockstep bumps — that line describes the
   lockstep group only);
3. updates `jsr.json` in any bumped package that has one, so the JSR version cannot drift;
4. records standalone versions back into `scripts/versions.json`, which the manifest audit then
   cross-checks against each `package.json`.

---

## Publishing (Pub)

`bun pub` runs `scripts/publish.js`, which builds and tests every targeted package, then runs the
**full local verification gate** with `--require-built` and aborts if anything fails.

The publish step is `bun publish`, which resolves `workspace:*` and `catalog:` at publish time and
packs the rewritten manifest. Nothing is rewritten on disk, so an interrupted publish cannot leave
resolved versions in your working tree (the old npm-based flow had to restore them from
`process.on('exit')` handlers).

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

**Other flags:** `--public` (public access for scoped packages; `bun pub` from the root passes it),
`--tolerate-republish` (do not fail when the version already exists), and `--no-gate` (skip the
local gate — emergencies only).

**Note:** publishing uses your existing npm credentials (`npm login` / `.npmrc`), so there are no
manual OTP prompts.

---

## Install layout

`bunfig.toml` pins `[install] linker = "hoisted"`. This is deliberate: parts of the toolchain (ESLint
and its own dependencies, Prettier, the `tsc` `.bin` shims) expect classic `node_modules` resolution.
Bun's isolated linker keeps transitive dependencies inside `node_modules/.bun`, which Node-based
shims cannot resolve.

`bun.lock` is committed and is the only lockfile; per-package `package-lock.json` /
`pnpm-lock.yaml` files are leftovers from before the Bun migration, and the workspace-integrity step
fails the gate if one comes back.

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

### ESLint warns about `.eslintignore`
There is no `.eslintignore` any more: ESLint 9 uses flat config, and ignores live in the
`jsx6/ignores` entry of [`eslint.config.js`](eslint.config.js). Note that those patterns are written
as `**/dist/**` rather than a bare `dist`, because a flat-config global ignore of `dist` only matches
the repository root — the generated `dist/`, `esm/` and `cjs/` inside each package would be linted.

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