/**
 * `$S`/`$F` with alien-aware dependency lists, shared by every direction that keeps the current core.
 *
 * Why this is needed at all: the core's `$F` decides between "derived" and "static value" with its own
 * internal `isObservable`, which knows nothing about alien nodes. Passing an alien `computed` to the
 * untouched `$F` therefore takes the *static* branch, and `staticSignal(alienNode)` hands you back a
 * signal whose value is the node itself. Normalising the dependency list before delegating is the fix,
 * and it stays outside `libs/` by design.
 *
 * `makeCompat` is memoised per core, so the bridges/mirrors created here are the same ones the
 * direction's `toAlien`/`toSignal` return.
 */

import { $S as core$S, $F as core$F, signal, observe, subscribe, isObservable } from '@jsx6/signal'
import { makeCompat } from './alien-compat.js'

const compat = makeCompat({ signal, observe, subscribe, isObservable })

export const $S = (template, ...deps) => core$S(template, ...compat.normalizeDeps(deps))
export const $F = (filter, ...deps) => core$F(filter, ...compat.normalizeDeps(deps))
