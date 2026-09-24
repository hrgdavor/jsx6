/**
 * DIRECTION A — compatibility / interop layer.
 *
 * Zero risk to existing behaviour: the real, untouched `@jsx6/signal` is re-exported as-is, and the
 * four observation entry points are overridden so that they also understand alien-signals nodes.
 * Nothing in `libs/` is imported differently or modified — this module simply *is* the compat layer a
 * consumer would import instead of `@jsx6/signal` when they want the two worlds to talk.
 *
 * What it adds on top of the baseline:
 *
 *   toAlien($sig)              jsx6 signal  -> alien node  (for `alien.computed` / `alien.effect`)
 *   toSignal(alienNode)        alien node   -> jsx6 signal (for JSX, `observeNow`, `$S`/`$F` deps)
 *   isAlienSignal/isAlienComputed
 *   observe / observeNow / subscribe / isObservable   now accept alien nodes
 *   $S / $F                    now accept alien nodes in their dependency list (via mirrors)
 *   batch(fn)                  alien-level coalescing of several writes
 *   dispose(node)              stop a mirror or a bridge
 *
 * Graduating this into the shipped package would mean moving the `isAlienNode` branch into
 * `libs/signal/src/observe.js` and the dependency normalisation into `index.js` — i.e. exactly the
 * diff this experiment deliberately avoids.
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
export const isAlienSignal = compat.isAlienSignal
export const isAlienComputed = compat.isAlienComputed
export const isAlienNode = compat.isAlienNode
export const toAlien = compat.toAlien
export const toSignal = compat.toSignal
export const dispose = compat.dispose
export const batch = compat.batch

export const observe = compat.observe
export const observeNow = compat.observeNow
export const subscribe = compat.subscribe
export const isObservable = compat.isObservable

/** `$S`/`$F` with alien dependencies normalised to jsx6 mirrors first. */
export { $S, $F } from '../_shared/derive-compat.js'

export const meta = {
  id: 'a-compat',
  name: 'A — compatibility / interop layer',
  backend: 'untouched current core + alien bridge',
  capabilities: ['core', 'union-deps', 'interop', 'interop:bridge-required', 'batch'],
  deps: ['alien-signals 3.2.1 (vendored, optional peer in a real release)'],
  sourceRoot: '.',
  notes:
    'does not change the core and therefore cannot auto-track: `$C` is absent, and a jsx6 signal read ' +
    'inside an alien computed must be bridged first (documented limitation). `batch` coalesces only ' +
    "the alien effect queue — it cannot defer the untouched core's own listener fan-out, which is why " +
    'it does not claim `batch:core`.',
}
