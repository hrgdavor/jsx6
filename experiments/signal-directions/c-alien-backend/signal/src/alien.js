/**
 * The one place that knows where the alien-signals dependency comes from.
 *
 * In this experiment the dependency is **vendored** (see `vendor/alien-signals/README.md`) so that no
 * root `package.json` / `bun.lock` change is needed. Graduating Direction C would replace this file's
 * body with a single line:
 *
 *     export * from 'alien-signals'
 *
 * and add `"alien-signals": "catalog:"` to `libs/signal/package.json#dependencies` together with a
 * root `catalog` entry.
 */

export * from '../../../vendor/alien-signals/index.mjs'
