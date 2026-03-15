# Developer Guide

This document provides instructions for developers working on the JSX6 monorepo.

## Building Modules

Most modules in `libs/` use `esbuild` for bundling and `tsc` for type declaration generation.

### esbuild (Bundling)
To build ESM and CJS bundles:
```bash
npm run build
npm run build-cjs
```

### tsc (Type Declarations)
We use JSDoc for typing. To generate `.d.ts` files for consumers:
```bash
bun x tsc
```
*Note: We use `bun x tsc` or `rushx tsc` to ensure the correct TypeScript version is used within the monorepo.*

---

## Versioning (Bump)

We manage several modules in lockstep versioning. To update all lockstep modules to a new version, use the `bump` script from the root:

```bash
bun run bump <new-version>
```
Example: `bun run bump 1.8.14`

This script will:
1. Update `package.json` for all modules listed in `scripts/versions.json`.
2. Update the `Current Version` in `MODULE_VERSIONING.md`.

---

## Publishing (Pub)

The publishing process differs depending on whether a module is part of the **lockstep group** (defined in `scripts/versions.json`) or a standalone package.

### 1. Lockstep Modules (Automated)
The publishing of lockstep modules is automated via `scripts/publish.js` to ensure safety and consistency. This script validates the entire group before any publication occurs.

**Command:**
```bash
bun run pub
```

**The Two-Phase Process:**
1. **Phase 1: Validation (Zero-Failure Policy)**: Runs `tsc`, `build`, and `test` for **all** lockstep modules. If any step fails, the process aborts.
2. **Phase 2: Actual Publish**: Prompts for NPM OTP and publishes each module in the group.

**Dry Run:**
```bash
bun run pub --dry-run
```

### 2. Standalone Modules (Manual)
Modules that are not part of the lockstep group (e.g., specialized tools or experimental libs) must be published manually from their respective directories:

```bash
cd libs/my-standalone-lib
npm run build
npm run build-cjs
bun test
npm publish
```

---

## Troubleshooting

### Windows ENOENT Errors
If you encounter `ENOENT` when spawning `npm` or `tsc` in scripts, ensure you are using `shell: true` in your spawn options. The `publish.js` script is already configured for this.

### TypeScript Resolution
If `tsc` is not recognized, ensure you have run `bun install` or `rush update` at the root to link the workspace dependencies.
