/**
 * `traceSignal` — a signal you can watch.
 *
 * ## What it is
 *
 * A thin, drop-in signal that wraps another one and reports its activations (a read, a write that
 * actually changed the value) to a console sink: value, kind, depth, creation site, dependencies, and
 * — for a computed — the **getter function**, which is the thing DevTools renders as a clickable
 * reference to the source.
 *
 * ## Why a wrapper is the right opt-in unit
 *
 * Library-wide tracing pays on every signal. A wrapper pays only where it is installed, and only on
 * the activations it is asked to report, so "debug this one signal" costs nothing anywhere else. The
 * wrapper is a full signal (subscribe/trigger/primitive), so it can be handed to `$S`/`$C`/`observe`
 * and the graph keeps working through it.
 *
 * ## The function-reference trick
 *
 * `console.log($sig)` is useless for a signal: a signal is a function, and DevTools renders a function
 * value as source text without listing its own properties. `$wrapped.show()` logs a **plain object**
 * whose `getter` is the compute function; DevTools renders that expansion with a clickable
 * `getter: ƒ cartTotal` line that jumps to the definition. That is what `snapshot()`/`show()` exist
 * for — see also `describeSignal` in `src/debug.js`, which solves the *value* half of the same problem.
 *
 * ```js
 * import { signal, $C, traceSignal } from '@jsx6/signal'
 *
 * const $total = traceSignal($C(() => $a() + $b(), 'total'), { label: 'total' })
 * $total()          // [trace] read computed total = 3 …
 * $total.show()     // { signal: 'total', value: 3, getter: ƒ (), deps: [...], raw: ƒ }
 * ```
 *
 * ## `$State`
 *
 * A state proxy can be wrapped too. Reads need nothing special (they go through the wrapper), but a
 * write — `$s.field = 5`, `mergeValue`, `setValue`'s reset — is performed by the proxy's `set` trap on
 * the **raw child signal**, so it would bypass the wrapper. The trap reports every child write
 * (`src/state-write-observer.js`) and the wrapper keeps the ones belonging to its own state:
 *
 * ```js
 * const $s = traceSignal($State({ count: 0 }), { label: 'cart' })
 * $s.count = 1              // [trace] write $State cart.count = 1
 * mergeValue($s, { count: 2 }) // [trace] write $State cart.count = 2   (once per changed child)
 * ```
 */

import { describeName, ensureTrace, signalTrace, traceSignals } from './trace.js'
import { onStateWrite } from './state-write-observer.js'

const subscribeSymbol = Symbol.for('signalSubscribe')
const triggerSymbol = Symbol.for('signalTrigger')
const mergeValueSymbol = Symbol.for('signalMergeValue')
const stateChildrenSymbol = Symbol.for('signalStateChildren')

/** A signal, or a `$State` proxy — which is also callable, and needs different delegation. */
const isStateProxy = $sig => Boolean($sig && typeof $sig !== 'undefined' && $sig[mergeValueSymbol])

/**
 * A `$State` proxy → the raw state callable behind it, for the setter paths that must bypass the proxy
 * (calling them through it would enter this wrapper again and report twice). Filled in as wrappers are
 * created, so it holds only traced states.
 *
 * @type {WeakMap<object, Function>}
 */
const rawStateOf = new WeakMap()

/** `computed` / `$State` / `signal`. State is tested first: a `$State` proxy creates a child signal for
 * any unknown key read through it, so probing one for `__computed` would add a field to the state. */
const kindOf = $sig => {
  if (isStateProxy($sig)) return '$State'
  if ($sig?.__computed) return 'computed'
  return 'signal'
}

const safe = fn => {
  try {
    return { value: fn() }
  } catch (e) {
    return { error: (e instanceof Error && e.message) || String(e) }
  }
}

const asText = value => {
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === undefined) return 'undefined'
  if (typeof value === 'function') return 'ƒ'
  if (value !== null && typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

const names = deps => {
  const list = deps?.tracked?.length ? deps.tracked : deps?.declared || []
  return list.map(d => describeName(d) || '?')
}

/**
 * Wrap a signal so its activations can be dumped.
 *
 * @param {Function|any} inner a signal. A *bare function* is also accepted when `options.getter` is
 *   supplied: the wrapper is then a plain signal storage whose compute function is reported, which is
 *   how a component's local computation gets a clickable source reference without changing the graph.
 * @param {{
 *   label?: string,
 *   log?: (...args) => void,               // default console.log
 *   warn?: boolean,                        // default false: use console.warn instead
 *   trace?: boolean,                       // default false: console.trace per activation
 *   only?: 'read'|'write'|'both',          // default 'both'
 *   max?: number,                          // default 5: dumps before it goes quiet
 *   getter?: Function,                     // for a bare-function wrap
 *   onActivate?: (info: object) => void,   // called on every activation, ignored by `max`
 * }} [options]
 * @returns {Function} a signal with `show()`, `snapshot()`, `describe()`, `raw` and `getter`
 */
export const traceSignal = (inner, options = {}) => {
  const innerIsState = isStateProxy(inner)
  // Asking for a traced signal *is* asking for tracing: turning it on here covers signals created
  // from now on, and `ensureTrace` covers this one if it already existed. Doing it at call time (and
  // not at import time) is what makes the behaviour independent of module evaluation order, and an
  // explicit `traceSignals(false)` afterwards still stops records for new signals.
  traceSignals(true)
  if (!innerIsState) ensureTrace(inner, options.getter ? 'computed' : undefined)

  const label = options.label || (innerIsState ? 'state' : describeName(inner)) || 'signal'
  const sink = options.warn ? options.log || console.warn : options.log || console.log
  const log = (...args) => sink.apply(console, args)
  const only = options.only || 'both'
  const max = options.max ?? 5
  const onActivate = options.onActivate
  const kind = options.getter ? 'computed' : kindOf(inner)
  let count = 0

  const read = () => inner()
  const safeRead = () => safe(read)

  /**
   * The dependency snapshot: read off the tracing record, never by re-running the getter.
   *
   * For a `$State` the dependencies *are* its children: the proxy exposes that map by reference — the
   * same one a computed uses for its aggregate-coverage rule — so no extra bookkeeping is involved.
   */
  const depsOf = () => {
    if (innerIsState) {
      const children = inner[stateChildrenSymbol]
      return children ? Object.keys(children) : null
    }
    const info = signalTrace(inner)
    if (!info?.deps) return null
    const { value, error } = safe(() => names(info.deps()))
    return error ? null : value
  }

  /** Everything a debugging tool wants, as a plain object — the shape DevTools can expand. */
  const snapshot = () => {
    const { value, error } = safeRead()
    const info = innerIsState ? null : signalTrace(inner)
    return {
      signal: label,
      kind,
      value: error ? `⚠ ${error}` : value,
      depth: innerIsState ? undefined : inner?.__depth,
      origin: info?.origin?.text || undefined,
      deps: depsOf() || undefined,
      getter: info?.getter || options.getter || (kind === 'computed' ? inner : undefined),
      listeners: info?.listeners?.size,
      raw: inner,
    }
  }

  /**
   * @param {string} activation
   * @param {{child?: string, value?: any}} [context] a state write: which child, and the value
   */
  const describe = (activation, context) => {
    const { value, error } = safeRead()
    const info = innerIsState ? null : signalTrace(inner)
    const head =
      `[trace] ${activation} ${kind} ${label}${context?.child ? `.${context.child}` : ''} = ` +
      `${error ? `⚠ ${error}` : context ? asText(context.value) : asText(value)}` +
      `${innerIsState || inner?.__depth === undefined ? '' : `  depth=${inner.__depth}`}`
    const lines = [head]
    if (info?.origin?.text) lines.push(`        origin: ${info.origin.text}`)
    const deps = depsOf()
    if (deps) lines.push(`        deps: ${asText(deps)}`)
    if (info?.listeners) lines.push(`        listeners: ${info.listeners.size}`)
    return lines.join('\n')
  }

  const fire = (activation, context) => {
    if (only !== 'both' && only !== activation) return
    const info = { activation, label, kind, count: count + 1, child: context?.child }
    if (onActivate) onActivate(info)
    if (count >= max) return
    count++
    try {
      if (options.trace) console.trace(describe(activation, context))
      else log(describe(activation, context))
      if (count === max) log(`[trace] ${label}: ${max} activations reported, going quiet`)
    } catch {
      // A debug tool must never break the signal it watches.
    }
  }

  /**
   * A `$State` write is performed by the proxy's `set` trap on the **raw child signal**, so a wrapper
   * around the state never sees it. That trap now reports every child write
   * (`src/state-write-observer.js`); this wrapper keeps the reports that belong to *its* state.
   */
  /** @type {null | (() => void)} */
  let unwatchStateWrites = null
  if (innerIsState) {
    const children = inner[stateChildrenSymbol]
    unwatchStateWrites = onStateWrite((child, value) => {
      // identity, not name: two states may share a field name.
      // `child` arrives typed as a plain Function; its `label` is what the library sets on a signal.
      const $child = /** @type {any} */ (child)
      if (children && children[$child.label] !== child) return
      fire('write', { child: $child.label || $child.name, value })
    })
  }

  // --- the signal itself -------------------------------------------------------------------------
  const $wrapped = (...args) => {
    if (args.length === 0) {
      const value = read()
      fire('read')
      return value
    }
    const result = inner(...args)
    // Only a real change activates: the `===` guard of the library is the signal's own truth, and
    // reporting a write that changed nothing would be the debugger lying about the graph.
    // A `$State` write is reported by its children's trap instead, per changed field — reporting it
    // here as well would say "the state changed" without saying which field, which is the noise this
    // whole feature exists to remove.
    if (result === true && !innerIsState) fire('write')
    return result
  }

  // --- protocol: delegated, so the wrapper is a drop-in signal -----------------------------------
  // A `$State` proxy keeps its protocol on special props reached through `get`, which type checks
  // cannot see; reading them by key works for both a signal and a proxy.
  $wrapped[subscribeSymbol] = u => inner[subscribeSymbol](u)
  $wrapped[triggerSymbol] = () => inner[triggerSymbol]()
  $wrapped[Symbol.toPrimitive] = () => read()

  // --- introspection ----------------------------------------------------------------------------
  // Held in a map rather than assigned as own properties, because a state wrapper has to hand
  // unknown property names to the state — and `name`, `length` and `caller` are own properties of
  // *any* function, so assigning them (`$t.name = 'grace'`) would either fail or silently shadow the
  // state's field. Every read below goes through `metadata`.
  const metadata = {
    label,
    kind,
    raw: inner,
    getter: options.getter || signalTrace(inner)?.getter || (kind === 'computed' ? inner : undefined),
    activations: () => count,
    snapshot,
    // Same contract as a signal: reading `.value` *is* a read, because the getter is the signal.
    get value() {
      return wrapper
    },
    show: () => {
      // Logs the plain object, which is what makes `getter` clickable in DevTools.
      const snap = snapshot()
      log(snap)
      return snap
    },
    describe: () => describe('read'),
    dispose: () => {
      // Release whatever this wrapper registered. For a `$State` that is its write observer — without
      // this, a long-lived page would accumulate one observer per traced state for the page's life.
      if (unwatchStateWrites) {
        unwatchStateWrites()
        unwatchStateWrites = null
      }
      inner?.dispose?.()
    },
  }

  const wrapper = innerIsState ? stateWrapper($wrapped, inner, metadata, fire) : $wrapped
  if (!innerIsState) {
    // A plain signal needs no interception: assign directly, as before.
    for (const key of Object.keys(metadata)) $wrapped[key] = metadata[key]
    Object.defineProperty($wrapped, 'get', { value: () => read(), configurable: true })
    Object.defineProperty($wrapped, 'value', { get: $wrapped, configurable: true })
    if (inner?.__computed)
      Object.defineProperty($wrapped, '__depth', { get: () => inner.__depth, configurable: true })
  }

  return wrapper
}

/**
 * The object a proxy wraps, or `null`.
 *
 * A proxy is transparent to every operation except one: `Proxy.revocable(target, handler)` stores its
 * `target` argument as `[[ProxyTarget]]` with no trap in the way. So applying *that* proxy to a key
 * makes the engine unwrap it to its target — which is the object we want — and the handler's first trap
 * can keep it. This is the only route: `$State` closes over its callable and exposes no other handle.
 */
const unwrapProxy = proxy => {
  /** @type {object | null} */
  let inner = null
  try {
    const outer = Proxy.revocable(proxy, {
      get: (target, prop, receiver) =>
        prop === innerSymbol ? (inner = target) : Reflect.get(target, prop, receiver),
    })
    void outer.proxy[innerSymbol]
    outer.revoke()
  } catch {
    return null
  }
  return inner && inner !== proxy ? inner : null
}
const innerSymbol = Symbol('innerTarget')

/**
 * The `$State` case: a proxy handle whose unknown property traffic belongs to the state.
 *
 * A state is written as `$s.field = 5`, so a wrapper that is not intercepting property access is not
 * a wrapper of that state at all — `$t.name = 'grace'` would hit the wrapper function's own `name`.
 * The intercept itself is why this is a proxy; plain signals deliberately do not pay for it.
 */
const stateWrapper = (callable, state, metadata, fireWrite) => {
  const children = state[stateChildrenSymbol]
  /**
   * The raw state callable behind the proxy, so the setter paths can bypass the wrapper — calling them
   * through the proxy would enter it again and report the same write twice.
   *
   * `$State` hands its proxy a function it closed over, so that function is reachable the same way it
   * was built: `Proxy.revocable` with the proxy as its *target* makes the engine hand the inner target
   * straight back. There is no other route — the proxy exposes no reference to it.
   */
  const rawState = unwrapProxy(state) || state
  rawStateOf.set(state, rawState)
  const targetProps = new Set(Object.getOwnPropertyNames(callable))

  /** A frame's own properties (protocol symbols, `name`, `length`) win over the state's fields. */
  const mine = prop => (targetProps.has(prop) || typeof prop === 'symbol' ? callable[prop] : undefined)

  /**
   * The write paths that never touch the proxy's `set` trap: `$state({...})` (the callable setter),
   * `mergeValue($state, {...})` and `setValue`'s reset-to-`undefined` loop. They all write the raw
   * child signals inside the state's own `updateValue`, so the only way to report them from outside is
   * to diff the children around the delegate.
   *
   * Diffing rather than trusting the result: `updateValue` answers "did anything change", not "which
   * field changed", and the whole point of a state trace is naming the field. Only genuinely changed
   * children are reported, which keeps `mergeValue` from claiming to have written a field it left
   * alone.
   *
   * Reporting starts *after* the delegate ran, so a throwing setter produces no report — matching the
   * field-assignment path, where the trap notifies before the write because `setValue`'s result is
   * available to it.
   */
  const reportAround = run => {
    if (!children) return run()
    const before = new Map()
    for (const key in children) before.set(key, children[key]())
    const result = run()
    for (const key in children) {
      const child = children[key]
      const now = child()
      if (Object.is(before.get(key), now)) continue
      fireWrite('write', { child: child.label || child.name, value: now })
    }
    return result
  }

  return new Proxy(callable, {
    apply(target, thisArg, args) {
      // A call with no arguments is a read of the whole state; `$wrapped` reports it.
      if (args.length === 0) return Reflect.apply(target, thisArg, args)
      return reportAround(() => Reflect.apply(target, thisArg, args))
    },
    get(target, prop, receiver) {
      if (prop in metadata) return metadata[prop]
      // `mergeValue` reads this symbol off the state and calls it with the patch; run that through the
      // same diff so a merge and a `$state({...})` call report identically.
      if (prop === mergeValueSymbol) {
        const merge = typeof rawState[mergeValueSymbol] === 'function' ? rawState[mergeValueSymbol] : null
        if (!merge) return undefined
        return patch => reportAround(() => merge(patch))
      }
      const own = mine(prop)
      if (own !== undefined || typeof prop === 'symbol') return own
      return Reflect.get(state, prop, state)
    },
    set(target, prop, value) {
      if (prop in metadata) return false // wrapper bookkeeping is not a state field
      return Reflect.set(state, prop, value, state)
    },
    has: (target, prop) => prop in metadata || Reflect.has(state, prop),
    ownKeys: () => Reflect.ownKeys(state),
    getOwnPropertyDescriptor: (target, prop) => Reflect.getOwnPropertyDescriptor(state, prop),
  })
}
