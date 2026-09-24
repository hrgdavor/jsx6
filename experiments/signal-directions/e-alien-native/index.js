/**
 * DIRECTION E — alien-signals' native surface, exposed as the computed answer.
 *
 * The cheapest possible way to give users `computed`: do not build one, document alien's. This module
 * is a raw re-export of alien's primitives next to the untouched `@jsx6/signal`, plus **only** the
 * compatibility layer — which is not optional, because without it an alien `computed` cannot be used
 * where JSX expects a signal (jsx2dom treats any function prop as a signal and would call
 * `observeNow` on it; unrecognised, it becomes a static value and renders as a function).
 *
 * The defining limitation, which is why E cannot claim the full `computed` capability:
 *
 *     const $a = signal(1)            // a jsx6 signal
 *     const c  = $C(() => $a() * 2)   // NOT tracked: `$a()` is an ordinary function call to alien
 *     const A  = toAlien($a)          // bridge it first…
 *     const c2 = $C(() => A() * 2)    // …now it tracks
 *
 * `$C` is literally `alien.computed`, so it also ignores a dependency list. Users who want tracking
 * over jsx6 signals must bridge explicitly (E), or use a wrapper that bridges for them (F), or a core
 * that does the tracking itself (B, C).
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

// These four shadow the `export *` re-exports: an explicit export wins over a star export, so
// importing this module gives the alien-aware versions while every other name stays the core's.
export const observe = compat.observe
export const observeNow = compat.observeNow
export const subscribe = compat.subscribe
export const isObservable = compat.isObservable

/** alien primitives under the names this repo uses. */
export const $C = compat.alien.computed
export const $watch = compat.alien.effect
export const $scope = compat.alien.effectScope
export const $trigger = compat.alien.trigger
export const $alienSignal = compat.alien.signal
export const startBatch = compat.alien.startBatch
export const endBatch = compat.alien.endBatch

// The core's own `$S`/`$F` cannot see an alien node (their internal `isObservable` does not know it),
// so an alien dependency would silently degrade to a static value. Normalising here is part of the
// compat contract, not a change to the core.
export { $S, $F } from '../_shared/derive-compat.js'

export const meta = {
  id: 'e-alien-native',
  name: 'E — alien-native surface ($C/$watch/$scope as-is)',
  backend: 'untouched current core + alien API re-exported',
  capabilities: [
    'core',
    'interop',
    'interop:bridge-required',
    'batch',
    'computed:alien-only',
    'alien-surface',
  ],
  deps: ['alien-signals 3.2.1 (vendored, optional peer in a real release)'],
  sourceRoot: '.',
  notes:
    'no core change at all. `$C`/`$watch`/`$scope`/`$trigger` are alien primitives, so they track ' +
    'alien values only — a jsx6 signal has to be bridged with toAlien() first. No dependency-list ' +
    'form, no eager mode, no repo-shaped dispose.',
}
