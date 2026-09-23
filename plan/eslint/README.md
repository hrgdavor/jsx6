# Move lint and format to Oxlint + Oxfmt

**Created:** 2026-09-22 (session following `plan/rush/README.md`)
**Scope:** the lint/format half of the toolchain — `eslint.config.js`, `.prettierrc.js`, `.prettierignore`, `tools/eslint-plugin-jsx6`, the root `lint`/`format` scripts, and the `eslint`/`prettier` entries in the root `catalog`.
**Parent plans:** [`plan/improvement-plan.md`](../improvement-plan.md) (decisions **D1** no-CI, **D2** local verification, **D3** toolchain) and [`plan/rush/README.md`](../rush/README.md) (the migration this one follows). Neither is re-opened here; D1 in particular means every change below must keep `bun run check` as the single local gate.

---

## 0. Decision summary (read this first)

This plan is **evidence-based on this repository**, not on vendor documentation. Everything marked *measured* was reproduced during the session that wrote it; the tool versions used were **oxlint 1.85.0** and **oxfmt 0.70.0**.

| # | Decision | Why |
|---|---|---|
| **O1** | **Adopt Oxfmt first, and do it in two steps: upgrade Prettier to 3.8 → then switch to Oxfmt.** | *Measured:* Oxfmt's output on this repo differs from **Prettier 3.8** by **4 lines in 4 files**, but differs from the **committed Prettier 2.7.1** output by **42 files / 711 lines**. The 711 lines are Prettier's own 2.7→3.8 change, not Oxfmt's. Splitting them keeps each diff reviewable and makes a revert trivial. |
| **O2** | **Adopt Oxlint, but only after a diagnostic-parity pass — do not flip the gate in one commit.** | *Measured:* Oxlint is **11.6× faster** (70 ms vs 811 ms best-of-5) yet reports **58 findings** where ESLint currently reports **0**. The delta is mostly `no-unused-vars`, and it must be triaged before it can gate anything. |
| **O3** | **The custom rule survives, with a one-line change.** | *Measured:* `tools/eslint-plugin-jsx6` loads in Oxlint as a JS plugin and fires correctly once it exports `meta.name`. Without that, Oxlint refuses to load it at all. This is the single code change the migration requires. |
| **O4** | **Drop `@trivago/prettier-plugin-sort-imports` — it is dead weight and Oxfmt cannot run it.** | *Measured:* it is declared in the root `package.json` but referenced by **no config**; `.prettierrc.js` has no `plugins` field. Nothing sorts imports today, so nothing is lost. This matches the owner's call that import sorting is not important to keep. |
| **O5** | **Treat Oxlint's JS-plugin support as alpha, and keep an exit path.** | Oxlint itself is stable (v1.x), but JS plugins reached **alpha in March 2026** and the custom rule depends on them. The plan keeps ESLint installable for one release so a regression is a config flip, not a rewrite. |

**Explicitly out of scope:** import sorting (O4), type-aware linting (this repo is JS + JSDoc and the gate's `tsc --checkJs` already covers that ground), and enabling Oxlint's default extras (`unicorn`, `oxc`, `typescript` plugins) as a *new* source of findings — see O2/Y3.

---

## 1. Current state (the inventory being replaced)

| Area | Today | Evidence |
|---|---|---|
| Linter | ESLint **9.39.5**, flat config | [eslint.config.js](../../eslint.config.js), `catalog.eslint: ^9.0.0` |
| Lint entry | `eslint .` (root script); the gate runs it over `libs tools scripts` with `--max-warnings 0` | [package.json:12](../../package.json#L12), [verify.js:236-245](../../scripts/verify.js#L236-L245) |
| Custom rule | `tools/eslint-plugin-jsx6` → `jsx6/signal-dependencies` (`warn`), plus a `RuleTester` suite that the gate's test step discovers | [tools/eslint-plugin-jsx6/rules/signal-dependencies.js](../../tools/eslint-plugin-jsx6/rules/signal-dependencies.js) |
| Formatter | Prettier **2.7.1** (configured, **not gated**) | `catalog.prettier: ~2.7.1`, [.prettierrc.js](../../.prettierrc.js) |
| Format entry | none at the root; three packages have a `format` script (`apps/repl`, `libs/editor-monaco`, `tools/build`) | grep of package manifests |
| Formatter settings | `semi: false`, `singleQuote: true`, `printWidth: 110`, `trailingComma: 'all'`, `arrowParens: 'avoid'`, `endOfLine: 'auto'` | [.prettierrc.js](../../.prettierrc.js) |
| Ignores | `.prettierignore` (53 lines) | [.prettierignore](../../.prettierignore) |
| Ignore comments in code | **zero** `prettier-ignore` / `oxfmt-ignore` comments anywhere | `git grep 'prettier-ignore\|oxfmt-ignore'` |
| Dead dependency | `@trivago/prettier-plugin-sort-imports ~3.3.0` declared, never wired | see O4 |

Two properties of this inventory make the migration easier than the docs assume: there are **no inline ignore comments** to translate, and import sorting is **already inert**.

---

## 2. Evidence gathered in this session

Reproduce with the §5 commands. All numbers are from this working tree at `plan/rush`'s completion state.

### 2.1 The custom rule works under Oxlint (the decisive question)

Oxlint's first attempt to load the repo's plugin fails:

```text
x Failed to load JS plugin: ./tools/eslint-plugin-jsx6/index.js
|   Error: Plugin must either define `meta.name`, be loaded from an NPM package with a
|   `name` field in `package.json`, or be given an alias in config
```

After adding `meta: { name: 'jsx6' }` to the plugin's export, the rule runs and reports exactly what ESLint reports:

```text
! jsx6(signal-dependencies): Signal "$sigB" is used in the callback but not listed as a dependency.
 ,-[probe.js:1:24]
1 | export const x = () => $S(() => $sigA() + $sigB(), $sigA)
```

Note this is the *only* blocker found on the repo side. The rule's `context.report` / AST-traversal style needs no changes.

### 2.2 Formatter output: Oxfmt ≈ Prettier 3.8, not Prettier 2.7

Both formatters were run on **identical pristine copies** of the tracked JS/JSX surface (164 files, extracted with `git checkout-index`), each with this repo's exact settings:

| Comparison | Files changed | Lines changed |
|---|---|---|
| Oxfmt vs **Prettier 3.8** | **4** | **4** |
| Oxfmt vs committed (Prettier 2.7.1) | 42 | 711 |
| Prettier 3.8 vs committed (Prettier 2.7.1) | 43 | 722 |

The four residual Oxfmt↔Prettier-3.8 differences are cosmetic and individually reviewable: a trailing space inside a block comment, a leading-semicolon placement before an IIFE-style statement, a `if … else` line-wrap choice, and `.prettierrc.js` itself (which is deleted by the migration anyway). **No semantic change was observed in any of the four.**

The dominant diff shape is Prettier 2.7 → 3.8 formatting an arrow function whose body is a block, e.g. in `libs/signal/index.js`:

```diff
 export const $Any = (...signals) =>
-  $S(
-    () => {
+  $S(() => {
       for (let i = 0; i < signals.length; i++) {
         if (signalValue(signals[i])) return true
       }
       return false
-    },
-    ...signals,
-  )
+  }, ...signals)
```

### 2.3 Lint speed

Best of five runs, `libs tools scripts`, same machine:

| Linter | Best | Notes |
|---|---|---|
| ESLint 9.39.5 | **811 ms** | 0 errors, 0 warnings today |
| Oxlint 1.85.0 | **70 ms** | **58 findings** today (see 2.4) |

**11.6× faster.** The absolute saving is ~0.75 s per gate run — real but small next to the manifest audit's ~13.7 s. The honest conclusion: **speed is not the reason to migrate this repo**; the reasons are consolidation, correctness of the custom-rule story, and dropping two heavyweight dependencies.

### 2.4 Diagnostic parity — the actual work

Oxlint, configured to mirror [eslint.config.js](../../eslint.config.js) (`env` browser/node/es2024, `jsx6/signal-dependencies: warn`, and `no-unused-vars` with the repo's options), reports:

| Source | Count | Comment |
|---|---|---|
| `eslint(no-unused-vars)` | 54 | 8 of them are **unused parameters**, e.g. `'self' is declared but never used` |
| `unicorn(no-new-array)`, `unicorn(no-useless-fallback-in-spread)` | 3 | Oxlint enables the `unicorn` plugin **by default**; ESLint has no such plugin configured |
| `oxc(only-used-in-recursion)` | 1 | Oxlint's own plugin, also on by default |
| **Total** | **58** | vs **0** from ESLint at the equivalent config |

Two concrete findings:

- The 4 `unicorn`/`oxc` findings are **not regressions** — they are rules this repo never enabled. They must be an explicit yes/no decision (Y3), not a surprise that blocks the migration.
- 3 of the `no-unused-vars` findings are `Catch parameter 'err' is caught but never used`, all in [scripts/publish.js](../../scripts/publish.js). The repo's config sets `caughtErrors: 'none'` to suppress exactly this, and **ESLint honours it**. A minimal controlled case showed Oxlint also honouring it, yet Oxlint still reports these three in the real file. **The cause was not isolated.** It is recorded here as an open characterization item (Y2) rather than explained away: it is the kind of option-handling gap that is expected from an alpha JS-plugin surface, and it must be understood before the gate flips.

### 2.5 Manifest churn is a separate decision

Oxlint/Oxfmt are not at issue here, but Oxfmt's **default `sortPackageJson: true`** rewrites **18 / 18** `package.json` files (reordering keys like `description`, `keywords`, `files`, `exports`), where Prettier 3.8 rewrites **8 / 18**. Reordering is semantically safe for this repo — `scripts/check-manifests.js` looks fields up by name, and `workspace:*` / `catalog:` values are untouched — but it is 18 files of noise that will bury the formatter change if it lands in the same commit.

---

## 3. Work items

Each item lists the change and how it is proven. Ordered so that the guard rails and the cheap wins land first.

### Y1 — Give the custom plugin a `meta.name` (enables everything else)

**Change.** Add `meta: { name: 'jsx6' }` to [tools/eslint-plugin-jsx6/index.js](../../tools/eslint-plugin-jsx6/index.js). Nothing else about the plugin changes; ESLint accepts `meta.name` too, so this is safe for the still-current linter.

**Also.** Update the `meta.docs` block of the rule to the flat-config shape if not already (it was cleaned for ESLint 9 in `plan/rush`), and keep the `RuleTester` suite passing.

**Prove:** `bun run check` green with ESLint; then Oxlint can load the plugin (see §2.1).

### Y2 — Oxlint config + diagnostic parity (the real migration)

**Change.**
1. Add `oxlint` to the root `catalog` and `devDependencies`.
2. Generate a first-pass config with the official tool:
   `bunx @oxlint/migrate eslint.config.js`
   Note: `@oxlint/migrate` **does not migrate local custom plugins** — the `jsPlugins` entry for `tools/eslint-plugin-jsx6/index.js` must be added by hand (documented behavior, not a defect).
3. Triage the 58 findings into exactly three buckets, with a decision recorded for each:
   - **Real defect** → fix the code.
   - **Rule too strict for this repo** → tune the option (e.g. `args: 'none'` semantics) or turn the rule off with a comment saying why.
   - **Rule this repo never enabled** (`unicorn`, `oxc`) → either opt out (`--disable-unicorn-plugin`, `--disable-oxc-plugin`, or config equivalents) to preserve exact parity, or adopt the findings as a deliberate improvement. **Recommendation: opt out first**, land the migration at zero-diff, then consider new rules as a separate change.
4. Resolve the `caughtErrors` discrepancy from §2.4 explicitly — do not paper over it with a broad rule disable if a narrower fix exists.
5. Wire it into the gate as a replacement for the ESLint step, preserving the `--max-warnings 0` intent: Oxlint exits **0** on warnings, so the gate must pass `--deny-warnings` (verified in §5) or the custom rule at `warn` severity stops gating anything. This is the exact trap `plan/rush` fixed for ESLint; do not re-introduce it.

**Prove:** `bun run scripts/lint-oxlint.js` (or equivalent) exits 0 on a clean tree, and a deliberately injected `$S` violation makes it exit non-zero.

### Y3 — Decide the new-rule question explicitly

Covered as Y2 step 3, called out separately because it is a **product** decision, not a technical one: does this repo want `unicorn/no-new-array` and friends? There are only 4 findings, so the cost of either answer is small — but it should be a recorded decision rather than an accident of defaults, because Oxlint's default plugin set will keep growing.

### Y4 — Formatter step 1: upgrade Prettier 2.7.1 → 3.8 (no tool change)

**Why first.** §2.2 shows the 711-line diff is Prettier's own 2.7→3.8 change. Landing it while still on Prettier isolates it completely from the tool switch, and it is independently valuable: the repo is on a Prettier release that is years behind.

**Change.** Bump `catalog.prettier` to `^3.8.0`, run `bun x prettier --write` over the JS/JSX surface, commit **only** that (plus any `.prettierrc.js` adaptation Prettier 3 requires).

**Watch for.** Prettier 3 changed some defaults and dropped `endOfLine: 'auto'` handling around `.gitattributes` (the config comment about `.gitattributes` may need updating). Also check the three package `format` scripts still work.

**Prove:** `bun run check` green; the diff is confined to formatting; the test suite is untouched semantically.

**Note.** If a 700-line formatting commit is unwelcome, the alternative is to skip this step and go straight to Oxfmt — the end state of the *code* is nearly identical (§2.2), but the single diff then mixes two causes and a revert loses both. Recommendation: keep the two steps.

### Y5 — Formatter step 2: switch to Oxfmt

**Change.**
1. Add `oxfmt` to `catalog` + `devDependencies`; remove `prettier` once nothing references it.
2. Migrate the config with the official tool:
   `bunx oxfmt --migrate=prettier`
   Keep the settings explicit: `printWidth: 110`, `singleQuote: true`, `semi: false`, `trailingComma: 'all'`, `arrowParens: 'avoid'`. Note Oxfmt's **default `printWidth` is 100**, so the explicit 110 is load-bearing.
3. Decide `sortPackageJson` (see §2.5). **Recommendation: `false` for the migration commit**, then enable it in a separate commit if the reordering is wanted — 18 rewritten manifests should not be mixed into a formatter swap.
4. Move `.prettierignore` (53 lines) into the Oxfmt config's `ignorePatterns`, or keep the file if Oxfmt honours it. Delete whichever is redundant.
5. Add root `format` and `format:check` scripts (`oxfmt` / `oxfmt --check`), and update the three package-level `format` scripts.
6. Fix the 4 residual diffs from §2.2 by accepting Oxfmt's output (they are cosmetic), and delete `.prettierrc.js`.

**Prove:** `oxfmt --check` exits 0 on a clean tree; `bun run check` green; the diff versus the Y4 commit touches only the 4 cosmetic sites.

### Y6 — Make formatting actually gated (the gap this exposes)

**Change.** Nothing in the gate runs a formatter today — `plan/implementation-status.md` records this as an open gap, and `plan/rush` explicitly left it alone. Adding `oxfmt --check` as a gate step while migrating is the natural moment, and it is cheap: **~14–85 ms** for the whole surface (§5), i.e. noise next to the 13.7 s manifest audit.

**Prove:** a deliberately mis-formatted file fails `bun run check`; reverting it passes.

### Y7 — Remove the dead import-sorting dependency

**Change.** Delete `@trivago/prettier-plugin-sort-imports` from the root `catalog` and `devDependencies`. It is referenced by no config (O4). Oxfmt could not run it anyway (`sortImports` is a native, separately-configured alternative, disabled by default — and per the owner's call it is not wanted).

**Prove:** `bun install --frozen-lockfile` after the lockfile update; `git grep trivago` returns nothing outside this plan.

### Y8 — Update the toolchain docs and the gate description

**Change.**
- `README.dev.md`: the gate table's `eslint` row, the flags list, and the `bun run lint` reference; add the Oxlint/Oxfmt story and the versions. The "ESLint cannot find its own modules" and "ESLint warns about `.eslintignore`" troubleshooting entries in the current file become obsolete or need rewriting.
- `plan/rush/README.md` §4 references `.eslintignore`/`eslint.config.js` history — leave the historical record intact, but do not let it read as current guidance.
- Note the **Windows caveat** honestly: the Oxlint JS-plugins announcement records out-of-memory issues specifically on Windows and recommends WSL. This repo is developed on Windows, so Y2's parity work should be *confirmed on this machine* before the ESLint fallback is removed.

**Prove:** A3-style grep shows no instruction that still says ESLint/Prettier when Oxlint/Oxfmt is meant.

### Y9 — Retire ESLint (only after the above is green and stable)

**Change.** Once the gate runs Oxlint and `oxfmt --check`, remove `eslint`, `@eslint/js`, `globals`, and `eslint.config.js` — **or** keep ESLint one release as the fallback if Y2's parity work left any unresolved gap. If ESLint is kept temporarily, use `eslint-plugin-oxlint` to disable overlapping rules so the two do not double-report.

**Prove:** `bun run check` green with ESLint uninstalled; the custom-rule test suite still runs (see below).

**Open question for the owner.** `tools/eslint-plugin-jsx6` has a `RuleTester` suite that the gate discovers as tests. After migration it is a *plugin under Oxlint*, so decide: (a) keep ESLint as a **test-only** devDependency so `RuleTester` keeps working, (b) port the suite to run the rule directly against Oxlint, or (c) drop the suite and rely on the gate's own injected-violation check. Recommendation: **(a)** — it is the only way to keep the rule's 13 existing test cases meaningful, and it costs one dev-only dependency rather than a rewrite.

---

## 4. Suggested sequencing

Every step ends with `bun run check` green.

1. **Y1 + Y7** — the one-line plugin change and deleting dead weight. Small, safe, no behavior change.
2. **Y6-adjacent groundwork + Y2** — stand up Oxlint *alongside* ESLint, do the parity triage, and only then make it the gate step. Do not delete ESLint in this step.
3. **Y4** — Prettier 3.8 formatting commit, on its own.
4. **Y5** — the Oxfmt switch (small diff, because Y4 already absorbed the churn).
5. **Y6** — turn on `oxfmt --check` in the gate.
6. **Y8, then Y9** — docs, then decide the ESLint retirement and settle the `RuleTester` question.

---

## 5. Verification commands used for the evidence

```bash
# --- the custom rule under Oxlint (Y1) -------------------------------------------------
# 1. stage oxlint + oxfmt in a scratch dir (do NOT add them to this repo yet)
cd "$TEMP" && mkdir ox-probe && cd ox-probe && bun init -y && bun add -d oxlint oxfmt
./node_modules/.bin/oxlint --version     # 1.85.0
./node_modules/.bin/oxfmt  --version     # 0.70.0

# 2. minimal config that loads the repo's own plugin
cat > .oxlintrc.json <<'EOF'
{
  "jsPlugins": ["./tools/eslint-plugin-jsx6/index.js"],
  "rules": { "jsx6/signal-dependencies": "warn" }
}
EOF
#    (copy tools/eslint-plugin-jsx6 into the scratch dir and add meta.name to index.js)
printf 'export const x = () => $S(() => $sigA() + $sigB(), $sigA)\n' > probe.js
./node_modules/.bin/oxlint probe.js         # expect the jsx6(signal-dependencies) report

# --- lint speed and parity (Y2) --------------------------------------------------------
# mirror eslint.config.js in .oxlintrc.json, then:
./node_modules/.bin/oxlint libs tools scripts            # 58 findings (vs ESLint's 0)
./node_modules/.bin/oxlint libs tools scripts --deny-warnings   # exit 1 — needed for the gate
# ESLint baseline for comparison (best of 5):
for i in 1 2 3 4 5; do time bun node_modules/eslint/bin/eslint.js libs tools scripts \
  --ext .js,.jsx,.cjs --max-warnings 0; done

# --- formatter comparison on pristine input (Y4/Y5) ------------------------------------
# two identical copies of tracked source, no generated trees:
mkdir "$TEMP/fmt-O" && git checkout-index -a -f --prefix="$TEMP/fmt-O/"
# strip dist/esm/cjs/build/docs/node_modules and non-JS extensions, then copy twice
oxfmt .                                     # copy A, with .oxfmtrc.json = repo settings
prettier --write "**/*.{js,jsx}"            # copy B, with .prettierrc.js = repo settings
git diff --no-index --numstat <copyA> <copyB>   # -> 4 files / 4 lines

# --- manifest sorting churn (§2.5) -----------------------------------------------------
oxfmt .          # over 18 package.json files -> 18 rewritten (sortPackageJson default on)
prettier --write "**/package.json"             # -> 8 rewritten
```

---

## 6. Risks kept in view

| Risk | Mitigation |
|---|---|
| Oxlint JS plugins are **alpha**; the custom rule depends on them | Y1 proves the rule runs *before* any commitment; Y9 keeps ESLint installable as a fallback |
| Oxlint reports 58 findings where the gate is green today | Y2 triages to zero (or to a recorded decision) **before** the gate flips; adopt alongside, not instead-of |
| A 700-line formatting diff buries the tool switch | Y4/Y5 split it into two commits with distinct causes |
| 18 rewritten manifests (`sortPackageJson`) | Default it off during migration; enable separately if wanted |
| Windows OOM is a documented Oxlint issue | Confirm parity on this machine (Y2/Y8) before removing the ESLint fallback |
| Gating semantics silently lost (`warn` ≠ failure) | Gate must use `--deny-warnings`; the same trap `plan/rush` documented for `--max-warnings 0` |
