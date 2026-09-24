/**
 * DIRECTION C — alien-signals as the backend, behind the jsx6 adapter.
 *
 * `./signal/` is a copy of `libs/signal` with the **storage and the propagation graph replaced by
 * alien-signals** while the public contract (K1–K10) is preserved:
 *
 *   src/signal.js    `prepareSignal` stores its value in an `alien.signal`; reads go through the alien
 *                    node (so alien-side tracking works with no bridge), writes keep the original
 *                    `===` change check and the synchronous listener fan-out
 *   src/computed.js  `$C`/`$CE` are `alien.computed` + a root `effect` that pushes into the jsx6
 *                    listener Set; `batch` is alien's `startBatch`/`endBatch`
 *   src/state.js     `updateValue`/`setValue` wrapped in the alien batch; `$State` marked so derived
 *                    signals recognise it as ours
 *   index.js         `$S`/`$F` are eager computeds over the alien graph, with the original
 *                    implementation kept as a fallback **only** for opaque duck-typed deps
 *
 * `libs/signal`'s 30 tests are copied alongside and pass unmodified — that is the parity proof for
 * C1 (the eager adapter). C2 (alien's computed exposed as `$C`) is layered on top of the same code.
 *
 * C-specific advantages over A/E/F: interop is *free* in the jsx6 -> alien direction (`toAlien` returns
 * the backing alien node — no listener bridge, no 26 % bridge tax), because the alien node already is
 * the storage.
 *
 * C-specific cost: `alien-signals` becomes a runtime dependency of the published package, and the
 * adapter is not smaller than the core it wraps (see the direction comparison table).
 */

import {
  signal,
  observe as coreObserve,
  subscribe as coreSubscribe,
  isObservable as coreIsObservable,
} from './signal/index.js'
// The internal source marker is deliberately NOT part of the package surface; deep `src/` imports are
// shipped by the manifest, so this is what a consumer would do too.
import { srcSymbol } from './signal/src/signal.js'
import { makeCompat } from '../_shared/alien-compat.js'

const compat = makeCompat({
  signal,
  observe: coreObserve,
  subscribe: coreSubscribe,
  isObservable: coreIsObservable,
})

export * from './signal/index.js'

export const alien = compat.alien
export const isAlienSignal = compat.isAlienSignal
export const isAlienComputed = compat.isAlienComputed
export const isAlienNode = compat.isAlienNode
export const toSignal = compat.toSignal

/**
 * Zero-cost bridge: the core's signals are alien-backed, so the alien node *is* the mirror. Only
 * foreign (non-C) signals need the listener-based bridge from the compat layer.
 */
export const toAlien = node => node?.[srcSymbol] || compat.toAlien(node)

/** Observation entry points that also understand alien nodes (needed for `{$computed}` in JSX). */
export const observe = compat.observe
export const observeNow = compat.observeNow
export const subscribe = compat.subscribe
export const isObservable = compat.isObservable

/** Stop whatever owns resources: a computed's push effect, or a compat mirror/bridge. */
export const dispose = node => node?.dispose?.()

export const meta = {
  id: 'c-alien-backend',
  name: 'C — alien-signals as backend behind the jsx6 adapter',
  backend: 'copied core rewritten on alien-signals 3.2.1',
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
    'interop',
    'interop:no-bridge-needed',
    'computed:alien-only',
  ],
  deps: ['alien-signals 3.2.1 (vendored; a real release would declare it in dependencies + catalog)'],
  sourceRoot: 'signal',
  notes:
    'the only direction that ships a new runtime dependency. Eager `$S`/`$F` are kept (a root effect ' +
    'keeps each eager computed hot), so long-lived components behave as before. Opaque duck-typed ' +
    'deps (trans.js) fall back to the legacy derived path — the one place C is not fully alien-driven.',
}
