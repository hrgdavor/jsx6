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

We use a centralized publish script to ensure all `workspace:*` and `catalog:` dependencies are resolved correctly before they reach the NPM registry.

### Unified Publish Process
The script `scripts/publish.js` handles build validation, test execution, dependency resolution, and public access configuration for scoped packages.

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

## Troubleshooting

### Windows ENOENT Errors
If you encounter `ENOENT` when spawning `npm` or `tsc` in scripts, ensure you are using `shell: true` in your spawn options. The `publish.js` script is already configured for this.

### TypeScript Resolution
If `tsc` is not recognized, ensure you have run `bun install` or `rush update` at the root to link the workspace dependencies.
