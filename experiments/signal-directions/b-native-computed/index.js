/**
 * DIRECTION B — computed + auto-tracking + batching, implemented **inside** the current core.
 *
 * `./signal/` is a copy of `libs/signal` (index.js + src/, tests included) with four changes:
 *
 *   1. `src/track.js` (new) + one line in `src/signal.js`'s getter → dependency tracking hook
 *   2. `src/computed.js` (new) → `createComputed`, `$C`, `$CE`, `batch`, `dispose`
 *   3. `src/state.js` → `updateValue`/`setValue` wrapped in `batch()`
 *   4. `index.js` → `createDerivedSignal` becomes an eager union-dependency computed
 *
 * Nothing in `libs/` is touched: the copy exists precisely so this can be tried, measured and thrown
 * away (or promoted) without risking the published package.
 *
 * `libs/signal`'s own 30 tests are copied alongside and must pass unmodified — they are the parity
 * proof. Run them with:
 *
 *     cd experiments/signal-directions/b-native-computed/signal && bun test
 */

export * from './signal/index.js'

export const meta = {
  id: 'b-native-computed',
  name: 'B — computed + auto-tracking + batch in the current core',
  backend: 'copied current core (own graph, no dependency)',
  capabilities: [
    'core',
    'union-deps',
    'computed',
    'computed:auto',
    'computed:dynamic-deps',
    'computed:eager',
    'dispose',
    'batch',
    'batch:core',
  ],
  deps: [],
  sourceRoot: 'signal',
  notes:
    'no dependency at all. `$C` is lazy, `$CE`/`$S`/`$F` are eager union-dependency computeds. ' +
    'Dependency edges reuse the existing listener Set; `batch` defers computed settle/notify in ' +
    'dependency order. No interop with alien-signals (that is A/E/F/C).',
}
