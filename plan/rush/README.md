# Finish the Rush → Bun workspaces migration

**Created:** 2026-09-22 (session following `cc12296` "improvements")
**Scope:** repo-wide toolchain — root manifests, `scripts/*`, `.gitignore`/`.prettierignore`/`.gitattributes`, every `libs/*`, `apps/*`, `tools/*` manifest, and the docs that describe them.
**Parent plan:** [`plan/improvement-plan.md`](../improvement-plan.md) — decisions **D1** (no CI), **D2** (local verification), **D3** (toolchain) remain binding and are not re-opened here.
**Status of the migration itself:** **complete.** The destructive half (Rush files, `common/`, stray lockfiles, `.rush/temp`) was already done and green before this document was written; R1–R7 below were implemented in the session that produced it, and §6 records what was actually done and what was deferred. Nothing here is aspirational any more — §2 is kept as the record of what the residue *was*, because each item explains why the fix looks the way it does.

---

## 0. Objective and acceptance criteria

The migration is finished when **all** of the following hold, verified by command, not by inspection:

| # | Criterion | Command that proves it | Result |
|---|---|---|---|
| A1 | No Rush artifact is tracked or present in the working tree | `git ls-files \| Select-String -Pattern 'rush\.json\|^common/'` → empty; `Get-ChildItem -Recurse -Force -Directory -Filter .rush` → empty | **pass** |
| A2 | Installs are reproducible from the committed lockfile alone | `bun install --frozen-lockfile` → `Checked N installs … (no changes)`, exit 0 | **pass** |
| A3 | No Rush/pnpm token survives as an *instruction*: none in a manifest, a script's behaviour, or a command a reader would follow. Deliberate remainders are allowed and must be explicit — the foreign-lockfile merge guards in `.gitattributes`/`.prettierignore` (which `check-workspace.js` now backs up) and the README translation table | `git grep -inE 'rush\|pnpm' -- ':!plan' ':!docs/demistify' ':!node_modules'`: every hit is a doc line, a defensive lockfile rule, or a comment saying what was replaced | **pass** |
| A4 | The publish path resolves `workspace:*` + `catalog:` without hand-editing manifests | `bun pub --dry-run` completes without `--manual-replace` and leaves `git status` unchanged | **pass** — `bun publish` rewrites at pack time; the rewrite-and-restore machinery is deleted |
| A5 | The gate still rejects a Rush-era regression | `scripts/check-workspace.js` in `bun run check` fails on a per-package lockfile, a non-`workspace:*`/`catalog:` internal dep, or a re-appearing `rush.json` | **pass** — verified by injecting each |
| A6 | One documented command installs, gates and publishes | `bun install` / `bun run check` / `bun pub`, documented in `README.dev.md` with the Rush equivalents mapped | **pass** |

---

## 1. What is already done (do not redo)

Recorded here so the remaining work is not obscured by re-litigating finished items. Verified in this session against the working tree at `cc12296`.

| Area | State | Evidence |
|---|---|---|
| Rush files deleted | `rush.json`, `common/config/rush/*`, `common/scripts/*`, `common/git-hooks/*` all removed (commit `06bf09e` + `dcc415d`) | `git cat-file -e HEAD:rush.json` → *path does not exist in 'HEAD'* |
| `.rush/temp/` directories | all 15 removed (was P3-4) | recursive `.rush` directory search → 0 results |
| Workspace definition | root `workspaces: ["libs/*","apps/*","tools/*"]`, `"private": true` | [package.json:15-19](../../package.json#L15-L19) |
| Catalog | Bun's **singular** `catalog` key, 11 entries | [package.json:20-32](../../package.json#L20-L32) |
| Internal deps | every cross-package reference uses `workspace:*` (33 occurrences) | grep of `libs/*/package.json`, `apps/*/package.json` |
| External deps | catalog-managed via `catalog:`; `scripts/check-versions.js` reads `rootPkg.catalog` (P1-4 fix) | [check-versions.js:3-6](../../scripts/check-versions.js#L3-L6) |
| Lockfile | single committed `bun.lock`; all 6 stray `package-lock.json`/`pnpm-lock.yaml` deleted (P1-11); `bun.lock` **in sync** | `bun install --frozen-lockfile` → `Checked 466 installs across 460 packages (no changes) [133ms]`, exit 0 |
| Install layout | `bunfig.toml` pins `[install] linker = "hoisted"` because Node-based `.bin` shims (eslint/prettier/npm) cannot resolve through Bun's isolated layout | [bunfig.toml](../../bunfig.toml) |
| Version policies | Rush `version-policies.json`/lockstep replaced by `scripts/versions.json` (`groups.lockstep`, 8 packages) + `MODULE_VERSIONING.md` | [versions.json](../../scripts/versions.json), [versions.js](../../scripts/versions.js) |
| Publishing | Rush `rush publish` replaced by `scripts/publish.js` (build → gate → publish → restore manifest) | [publish.js](../../scripts/publish.js), root `pub` script |
| Ignore/hook files | `.gitignore` / `.prettierignore` carry no Rush sections; `.gitattributes` is hand-written (P4-6) and keeps `merge=binary` for the three *foreign* lockfile names as a safety net; `.githooks/pre-commit` runs `--quick` (opt-in, not CI) | [.gitattributes](../../.gitattributes), [.githooks/pre-commit](../../.githooks/pre-commit) |
| Tests | green in this session: `bun run test` → 1 step PASS, exit 0 | `bun run test` |

**Do not re-propose:** restoring a pipeline, re-adding a second package manager, or re-introducing per-package lockfiles. D1 forbids the first; A2/A5 forbid the other two.

---

## 2. Residual Rush-era assumptions

Each item states the evidence, why it is *Rush-era residue* rather than ordinary debt, the fix, and the command that closes it.

### R1 — the publish and pack path still requires the npm CLI (highest value)

**Evidence.** `scripts/publish.js` spawns `npm publish` ([:276](../../scripts/publish.js#L276)); `scripts/check-manifests.js` shells out to `npm pack --dry-run --json` for all 17 publishable packages ([:174](../../scripts/check-manifests.js#L174)). The in-place manifest rewrite ([:237-261](../../scripts/publish.js#L237-L261)) — plus the snapshot/exit-handler restore machinery that exists only to undo it — is needed **because** `npm publish` cannot resolve `workspace:*` or `catalog:`.

**Why this is migration residue.** Rush's publish flow was the reason `workspace:*`/`catalog:` had to be *materialized* before publishing at all. Bun can do both natively, so the entire rewrite-and-restore mechanism is a Rush-era workaround that outlived Rush.

**Fix.**
1. Confirm Bun's behaviour first, with a scratch throwaway package (not a real package.json):
   `bun publish --dry-run` on a copy of `libs/popover` — inspect whether the emitted manifest has `@jsx6/dom-observer: 1.0.x` (rewritten) or `workspace:*` (not rewritten), and whether `catalog:` entries are resolved. Bun 1.3.14 supports `bun publish --dry-run`; the rewriting behaviour is the one thing this plan does **not** assume.
2. If both are rewritten → replace `npm publish` with `bun publish`, delete `--manual-replace` from the root `pub` script, and delete `resolveDeps` + `manifestSnapshots`/`restoreManifests` + the signal handlers from `publish.js` (~70 lines). Keep the gate invocation and the retry prompt.
3. If only `workspace:*` is rewritten and not `catalog:` → keep `resolveDeps` for `catalog:` only and drop the `workspace:` branch.
4. If neither is rewritten → keep the current mechanism, and record the finding in this document so it stops being re-investigated.
5. Independently of (2)–(4): replace the pack source in `check-manifests.js`. `bun pm pack --dry-run` is available and works here (verified: it lists `package.json`, `README.md`, `cjs/index.js`, `dist/index.d.ts` … and honours `files`), but it has **no `--json`** flag — `--json` is silently ignored and it exits 0. Parse its `packed <size> <path>` lines, or keep `npm pack --json` and document npm as an intentional dev-only tool.

**Closes:** A4. **Verify:** `bun pub --dry-run` (lockstep group) with `git status` clean afterwards — no manifest should need restoring.

### R2 — the Bun version is unpinned

**Evidence.** No `packageManager`, no `engines.bun`, no `.bun-version`, no `bun.lock`-adjacent policy anywhere in the root [package.json](../../package.json). Local version is Bun 1.3.14.

**Why this is migration residue.** Rush pinned its own version through `rushVersion` in `rush.json`, and `common/scripts/install-run-rush.js` bootstrapped exactly that version. That guarantee is gone, and it mattered for a specific reason: the root catalog uses Bun's **singular** `catalog` key — the plural `catalogs.default` form this repo migrated *away from* is what `scripts/check-versions.js` used to read. Catalog `key` semantics have changed across Bun releases, so an older Bun silently ignores a catalog and resolves a different tree than the lockfile was built from.

**Fix.** Add `"packageManager": "bun@<version>"` (and optionally `"engines": { "bun": ">=<version>" }`) to the root `package.json`, matching a version that reads the singular `catalog` key. Add one line to `README.dev.md` naming the required Bun version and where it is declared.

**Closes:** part of A6. **Verify:** `bun install --frozen-lockfile` still exits 0; `bun run check` still green.

### R3 — nothing in the gate prevents a Rush-era regression

**Evidence.** `scripts/check-versions.js` is the only workspace-hygiene step in the gate (verify.js step 6), and it only asserts catalog usage for deps that are *already* in the catalog. It does not catch: a re-added `rush.json`/`common/`, a reappearing `package-lock.json`/`pnpm-lock.yaml` in a package, a cross-package dependency written as a semver range instead of `workspace:*`, or `catalogs.default` being reintroduced. The dry run during this session showed an abbreviated `bun install` quickly listing package-lock and pnpm-lock remnants from the broader tree — i.e. these files do reappear if someone runs `npm install` in a package.

**Why this is migration residue.** Rush's `rush install` refused to run against a foreign lockfile — the invariant "one package manager" was *enforced by the tool*. Bun does not enforce it for you.

**Fix.** Add `scripts/check-workspace.js`, a small Bun script in the style of `check-versions.js`, and wire it into `verify.js` as its own step (and a `--no-workspace` flag, matching the existing flag style). It should fail on:
- `rush.json`, or a `common/config/rush/` directory, at the root;
- any `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, or `shrinkwrap.json` outside `.tmp`/`node_modules`/`docs/`;
- any `libs/*`, `apps/*`, `tools/*` manifest that has a `catalogs` key (the Rush-era plural) rather than relying on the root `catalog`;
- any dependency on another workspace package (`@jsx6/*`, `eslint-plugin-jsx6`) that is not exactly `workspace:*` (allow `npm:` for the deliberate per-package babel plugins);
- a `.rush/temp` directory anywhere.

Keep it cheap: pure manifest/file checks, no subprocesses, so the gate stays under a second for this step.

**Closes:** A5. **Verify:** temporarily create `libs/popover/package-lock.json` → gate fails; delete it → gate passes.

### R4 — `catalog:` coverage is descriptive, not enforced

**Evidence.** [check-versions.js:27-34](../../scripts/check-versions.js#L27-L34): a dependency **not** in the root catalog only prints `[INFO] … is not in the root catalog` and continues. Only *catalog-managed* deps are required to use `catalog:`. So the catalog can drift toward meaninglessness while the gate stays green — for example `@babel/standalone: "~7.18.12"` in `apps/repl`, `babel-plugin-syntax-jsx: "~6.18.0"`, `babel-plugin-jsx-simple: "~1.6.0"`, `markdown-it`, `mulmd`, `perfect-scrollbar` are all version-pinned outside the catalog today.

**Why this is migration residue.** Rush's `common-versions.json` + `rush check` enforced a single version per dependency across the whole repo. Bun's catalog only centralizes what you put in it — the *enforcement* half of the Rush behaviour has no replacement yet.

**Fix.** Decide and record the policy (this is the only genuinely open decision, see §3):
- **(a) Enforce now:** add a `--strict` mode that fails on any recurring bare version, move the offenders above into the catalog, keep `[INFO]` for one-off deps.
- **(b) Enforce later:** keep the current informational behaviour, but have `check-workspace.js` (R3) fail when the *same* package is pinned to *different* versions in two manifests — the actual drift Rush prevented, without demanding full centralization.

Recommendation: **(b)** now, **(a)** when the catalog list next changes for another reason. (b) catches the bug class that hurt, costs nothing today, and does not force a dependency-churn commit into the migration.

**Verify:** pin `typescript` to two different ranges in two manifests → gate fails.

### R5 — ESLint 8 legacy config is the last non-Bun-shaped tool input

**Evidence.** [.eslintrc.cjs](../../.eslintrc.cjs) + [.eslintignore](../../.eslintignore), loaded by `bun node_modules/eslint/bin/eslint.js` from `verify.js` ([:129-142](../../scripts/verify.js#L129-L142)). The comment at the top of that function explains that the `.bin` shims were bypassed *because of Bun's linker* — a Bun-migration workaround now committed permanently.

**Why this is adjacent, not central.** ESLint 9 flat config (`eslint.config.js`) would remove `.eslintignore` and the `--ext` flag, but it is a lint-tooling upgrade rather than a Rush leftover. **Include it only if** this migration is the natural moment; otherwise record it as explicitly out of scope here so a future reader does not think it was overlooked. Note also that `.prettier`/`format` scripts exist in several packages but **prettier is not run by the gate at all** — a real gap, but again not Rush residue.

**Verify (if done):** `bun run check` green with `.eslintignore` deleted and `eslint.config.js` present.

### R6 — documentation says "Rush is gone" but never says what replaced each Rush command

**Evidence.** [README.md:37-38](../../README.md#L37-L38) and [README.dev.md:138-139](../../README.dev.md#L138-L139) state that Rush and pnpm are gone, and MODULE_VERSIONING.md:3 says "migrated from Rush version policies". Nothing maps the old muscle memory to the new commands.

**Fix.** Add a short migration table to `README.dev.md` (not to this plan — it is user-facing):

| Rush command | Now |
|---|---|
| `rush update` | `bun install` (`--frozen-lockfile` for a clean-checkout equivalent) |
| `rush build` | `bun run check --build` (or per-package `bun run build`) |
| `rush test` | `bun run test` |
| `rush change` / `rush version --bump` | `bun run bump <version>` (`scripts/versions.js`) |
| `rush publish` | `bun pub` (`scripts/publish.js`) |
| `rush check` | `bun run check` — but note it is **not** the same thing: `rush check` verified one version per dep, which R4 currently does not |

Also drop the parenthetical "(Rush used `catalogs.default`)" from [check-versions.js:4](../../scripts/check-versions.js#L4) — it is the last Rush token in executable code and the distinction now lives in this document and in R2.

**Verify:** A3's grep.

### R7 — `version policies`-equivalent gaps in the replacement (small)

**Evidence, all in `scripts/versions.js`:**
- only `groups.lockstep` exists; Rush's `version-policies.json` supported several policies (this repo used lockstep + individual). Individual/standalone packages have no bump path at all — `bun run bump 1.0.1` cannot bump `libs/popover` alone.
- only `jsr.json` is kept in sync (P1-8); `MODULE_VERSIONING.md`'s *Standalone Modules* section has no version column, so a standalone bump would not be visible there either.
- `scripts/versions.json` is dead weight for "which packages are which" because `check-manifests.js` derives lockstep membership by *parsing `MODULE_VERSIONING.md`* ([:200-210](../../scripts/check-manifests.js#L200-L210)). Two sources of truth for the same fact.

**Fix (small, optional within this migration).** Either generate the `MODULE_VERSIONING.md` lists from `scripts/versions.json` (single source), or have `versions.js` support `groups.<name>` + a `standalone` list. Do not do both. If deferred, add the "two sources of truth" note to `MODULE_VERSIONING.md` so it is not rediscovered.

**Verify:** `bun run bump` with a bump for a standalone package changes exactly that package + the doc; `bun run check` stays green.

---

## 3. Decisions taken (all answered — nothing open)

1. **R4 policy:** fail only on version drift between manifests, not on full catalog centralization. Recurring-but-consistent pins stay `[INFO]`. No dependency churn.
2. **R1 npm dependency:** npm is kept for exactly one job — `npm pack --dry-run --json` in the manifest audit — because it is the reference packer and the only one with machine-readable output; `bun pm pack --plain` has no `--json` (verified: the flag is silently ignored, exit 0) and would have to be scraped. Publishing itself is now `bun publish`. `npm` is therefore a dev-only tool, never an installer, and `check-workspace.js` fails the gate if an npm lockfile reappears.
3. **R5 ESLint 9 flat config:** in scope, and done.
4. **R2 pin:** Bun 1.3.14 — the version this migration was verified on.
5. **R7:** `versions.js` gained standalone bump support and `scripts/versions.json` became the authoritative version record (cross-checked by the manifest audit); `MODULE_VERSIONING.md` stays hand-written.

---

## 4. What was implemented

| Item | Change |
|---|---|
| R1 | `scripts/publish.js` now publishes with **`bun publish`** and dropped `resolveDeps`, `getAllPackageVersions`, the manifest snapshots, the `process.on('exit')` + signal restore handlers, and the `--manual-replace` flag (root `pub` script too). ~110 lines removed. `--public` maps to `--access public`, `--dry-run` to `bun publish --dry-run`, and `--tolerate-republish` / `--no-gate` were added. Per-module builds now run through `bun run build` rather than `npm run build`. |
| R2 | Root `package.json`: `"packageManager": "bun@1.3.14"` and `"engines": { "bun": ">=1.3.14" }`; the floor and its rationale are documented in `README.dev.md` and `README.md`. |
| R3 | New `scripts/check-workspace.js` (5 checks: Rush artifacts, foreign lockfiles, plural `catalogs` key, internal deps must be `workspace:*`, no version drift), wired into `verify.js` as step 9 with a `--no-workspace` flag. Costs 0.2 s. |
| R4 | The drift check landed inside `check-workspace.js` rather than `check-versions.js`, so the two scripts keep one concern each. Verified by injecting conflicting pins. |
| R5 | `eslint.config.js` (flat config) replaces `.eslintrc.cjs` + `.eslintignore` (both deleted); ESLint 8.57 → 9.39 via the catalog; `@eslint/js` and `globals` added to the catalog and root devDependencies. The gate now passes `--max-warnings 0` so the `jsx6/signal-dependencies` rule (warning severity) cannot silently stop gating. |
| R6 | `README.dev.md` gained a "Toolchain: Bun workspaces (Rush is gone)" section with the Rush→Bun command table and the Bun floor; `README.md` points at it. The last Rush token in executable code (the `catalogs.default` comment in `check-versions.js`) is now a statement about what Bun's `catalog` replaced. |
| R7 | `scripts/versions.js` supports `--pkg <name>` and `--standalone`, records standalone versions into `scripts/versions.json`, and `check-manifests.js` fails when that record disagrees with a manifest. |

**Two things worth knowing for the next person:**

1. **Flat-config ignores are not `.eslintignore` ignores.** A global ignore of `dist` in flat config matches only `<root>/dist`; the generated `dist/`, `esm/`, `cjs/` inside every package *were* linted (4,183 errors) until the patterns were written as `**/dist/**`. Documented in `eslint.config.js` and in `README.dev.md` troubleshooting.
2. **`bun publish` failing Phase 1b was a real finding, not a regression.** `scripts/publish.js` runs the gate with `--require-built`, which is strict: a package whose declared `cjs`/`esm` outputs were never built makes the audit fail (`@jsx6/virtual-scroll` was in exactly that state because only `dist/` had been emitted). The fix is `bun run build && bun run build-cjs` in that package — and it means a *publish is the moment that catches a package that was never fully built*, which is the behaviour the plan asked for.

### Deliberately not done

- **ESLint 9's `caughtErrors` default is overridden back to `'none'`** to preserve pre-9 behaviour. Without it, four unused `catch (err)` bindings in `publish.js` were errors; the repo treats unused catch params as intentional.
- **`apps/` is still outside the gate's lint scope.** That is the pre-existing open decision from `plan/implementation-status.md` (JSX-aware `no-unused-vars` needed), not Rush residue, and migrating the linter config did not change it.
- **`prettier` is still not enforced by the gate.** `.prettierignore` is maintained, but nothing runs prettier in `verify.js`. Not Rush residue; recorded here so it is not mistaken for a regression from R5.
- **`.eslintignore`-style vendor exclusions** for `apps/repl/public` were not carried over as a broad ignore; the flat config ignores `**/public/vendor/**`, which is the actual vendored monaco/babel output.

---

## 5. Verification sweep (copy-paste, from the repo root)

```bash
# A1 — no Rush artifacts, tracked or on disk
git ls-files | grep -Ei 'rush\.json|^common/'
find . -type d -name .rush -not -path '*/node_modules/*'

# A2 — reproducible install from the committed lockfile
bun install --frozen-lockfile          # expect: "Checked N installs ... (no changes)", exit 0

# A3 — no era token left as an instruction (doc lines, defensive lockfile rules and
# "what replaced this" comments are expected; a manifest or a command is not)
git grep -inE 'rush|pnpm' -- ':!plan' ':!docs/demistify' ':!node_modules'

# A4 — publish resolves workspace:/catalog: without hand-editing manifests
git status --porcelain                 # expect: only intended edits
bun pub libs/popover --dry-run         # expect: exit 0, and no manifest rewritten by the publish
git status --porcelain                 # expect: unchanged by the publish run

# A5 — the gate rejects a Rush-era regression (each must FAIL)
echo '{}' > libs/popover/package-lock.json && bun run check
Set-Content rush.json '{}' && bun run check
# ...then delete them

# A6 — the documented loop works end to end
bun install && bun run check && bun run test
```

Measured on this machine after the changes: **`bun run check` = 29.5 s**, 8/8 steps PASS (the
workspace-integrity step itself is 0.2 s). The manifest audit remains the long pole at ~13.7 s
(17 `npm pack` invocations), which is why R1 kept npm for the audit rather than trading a JSON
listing for a scraped one.
