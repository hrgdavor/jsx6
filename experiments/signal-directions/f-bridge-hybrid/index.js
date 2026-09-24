/**
 * DIRECTION F — bridge-only hybrid.
 *
 * Get a lazy, memoized, auto-tracking `$C` **without touching the core at all**: A's compat layer plus
 * a ~15-line wrapper that bridges each declared dependency and hands the composition to alien.
 *
 *     $C(fn, ...deps)  ===  alien.computed(() => fn(...deps.map(d => toAlien(d)())))
 *
 * It supports both calling styles, because reading a bridged dependency makes it tracked no matter
 * how `fn` uses it:
 *
 *     $C(() => A() + B())        // alien values read directly — tracked
 *     $C((a, b) => a + b, $a, $b) // jsx6 signals as declared deps — bridged, tracked, values passed
 *
 * What it cannot do (and therefore does not claim):
 *
 *   - `computed:auto` over **jsx6** signals: `$C(() => $a() * 2)` with no deps is not tracked, because
 *     tracking requires a hook in the signal's getter and F never touches the core. Bridging is the
 *     only way in.
 *   - `computed:eager`  — alien `computed` is pull-based; an eager mode needs an effect + a mirror,
 *     which is Direction C's job.
 *   - `dispose`         — a standalone alien computed retains its dependency links (upstream #79);
 *     releasing them needs `effectScope` ownership, which would force an early read and lose laziness.
 *
 * Bridges are cached per source signal (WeakMap), so listing the same dependency twice costs one
 * bridge. Bridge overhead measured at ~26 % on a synthetic write+read loop versus the current core.
 */

import {
  signal,
  observe as coreObserve,
  subscribe as coreSubscribe,
  isObservable as coreIsObservable,
} from '@jsx6/signal'
import { makeCompat } from '../_shared/alien-compat.js'

const compat = makeCompat({
  signal,
  observe: coreObserve,
  subscribe: coreSubscribe,
  isObservable: coreIsObservable,
})

export * from '@jsx6/signal'

export const alien = compat.alien
export const toAlien = compat.toAlien
export const toSignal = compat.toSignal
export const isAlienSignal = compat.isAlienSignal
export const isAlienComputed = compat.isAlienComputed
export const isAlienNode = compat.isAlienNode
export const dispose = compat.dispose
export const batch = compat.batch

export const observe = compat.observe
export const observeNow = compat.observeNow
export const subscribe = compat.subscribe
export const isObservable = compat.isObservable

// The core's `$S`/`$F` cannot see alien nodes, so an alien dependency would degrade to a static
// value; normalise the list before delegating (part of the compat contract, not a core change).
export { $S, $F } from '../_shared/derive-compat.js'

/**
 * Lazy computed over bridged dependencies.
 *
 * `$C(fn)`            — for alien values read inside `fn` (tracked natively).
 * `$C(fn, ...deps)`   — deps are bridged and their values are passed to `fn`.
 */
export function $C(fn, ...deps) {
  if (!deps.length) return compat.alien.computed(() => fn())
  const nodes = deps.map(d => compat.toAlien(d))
  return compat.alien.computed(() => fn(...nodes.map(n => n())))
}

export const meta = {
  id: 'f-bridge-hybrid',
  name: 'F — bridge-only hybrid ($C over bridged deps)',
  backend: 'untouched current core + alien computed over bridges',
  capabilities: [
    'core',
    'union-deps',
    'interop',
    'interop:bridge-required',
    'batch',
    'computed',
    'computed:alien-only',
  ],
  deps: ['alien-signals 3.2.1 (vendored, optional peer in a real release)'],
  sourceRoot: '.',
  notes:
    '~15 lines on top of A. Lazy only (no eager mode), explicit dependencies required for jsx6 ' +
    'signals, no dispose (standalone alien computeds retain deps), ~26 % bridge overhead.',
}
