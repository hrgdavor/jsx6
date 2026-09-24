/**
 * DIRECTION D — the dual-surface facade and the comparison runner.
 *
 * D is scaffolding, not a signal implementation: it is the machinery that lets **every other
 * direction, plus the untouched baseline, be exercised through one identical facade** and produce one
 * comparison table. Without it each direction would be measured with its own hand-written harness and
 * the numbers would not be comparable.
 *
 * Two things it provides:
 *
 * 1. `load(id)` — resolve a direction by id (`baseline`, `a-compat`, …) into its module.
 * 2. `aliasRecipe()` — how to point a **real app at an alternative backend without editing it**:
 *    an esbuild plugin that rewrites the `@jsx6/signal` specifier to a direction's copied core. That
 *    is the step that makes "use it and then decide" possible for `apps/repl`/`apps/nodditor`, which
 *    import `@jsx6/signal` directly.
 *
 * Deliberately not shipped: adding a runtime backend switch to the published package would be
 * permanent complexity for a temporary question. This lives in `experiments/` and is deleted once the
 * decision is recorded.
 */

import { readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')

/** Ids of every direction that exposes an `index.js` entry. */
export const directionIds = () =>
  readdirSync(ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('_') && e.name !== 'harness' && e.name !== 'vendor')
    .map(e => e.name)
    .filter(name => {
      try {
        return statSync(join(ROOT, name, 'index.js')).isFile()
      } catch {
        return false
      }
    })

/** Load a direction module by id (or by an explicit relative path). */
export const load = id => {
  const entry = id.includes('/') ? id : `../${id}/index.js`
  return import(entry)
}

/**
 * esbuild plugin that redirects `@jsx6/signal` (and its subpaths) to a direction's copied core, so an
 * unmodified app can be built against a candidate backend.
 *
 * ```js
 * import { build } from 'esbuild'
 * import { aliasRecipe } from './experiments/signal-directions/d-dual-surface/index.js'
 * await build({ entryPoints: ['apps/repl/src/index.jsx'], bundle: true, plugins: [aliasRecipe('b-native-computed')] })
 * ```
 *
 * For direction B the copy's entry is `signal/index.js`; for C it is also `signal/index.js`; for A/E/F
 * there is no copied core (they layer on the real one) so aliasing is only meaningful for B and C.
 */
export const aliasRecipe = id => ({
  name: `jsx6-signal-alias:${id}`,
  setup(build) {
    const target = join(ROOT, id, 'signal', 'index.js')
    const filter = /^@jsx6\/signal(\/.*)?$/
    build.onResolve({ filter }, args => {
      if (args.path === '@jsx6/signal') return { path: target }
      // Deep subpaths (`@jsx6/signal/src/state.js`) resolve inside the copy.
      const sub = args.path.slice('@jsx6/signal'.length)
      return { path: join(ROOT, id, 'signal', sub) }
    })
  },
})

export const meta = {
  id: 'd-dual-surface',
  name: 'D — facade + A/B runner (scaffolding, not an implementation)',
  backend: 'delegates to the selected direction',
  capabilities: [],
  deps: [],
  sourceRoot: '.',
  notes: 'no signal code of its own; it is the comparison machinery and the app-alias recipe.',
}
