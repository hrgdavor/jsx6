/**
 * Signal tracing internals — the small, opt-in surface a debugger wrapper needs.
 *
 * ## Why this is a module of its own
 *
 * A signal is a function, and DevTools renders a function value as source text: it lists none of the
 * function's own properties, and it does not run custom formatters for functions. So there are exactly
 * two things a debugging tool can hold on to:
 *
 *   - a **plain object** whose properties are the interesting references (`getter`, `listeners`, the
 *     raw signal) — DevTools expands it and renders each function as a clickable link to its source;
 *   - a **site string** (`file:line:col`) that can be printed next to the value.
 *
 * Both need information that only the signal implementation has: the getter a computed was built
 * from, the current dependency set, the listener set, the site a signal was created at. This module
 * attaches that information — and nothing else — when somebody asks for it.
 *
 * ## The cost model, which is the whole reason this is gated
 *
 * `signalsTraced` is `false` by default, and every hook in the library is written as
 * `if (signalsTraced) attach…()`. That is one boolean test on a creation path that already exists, and
 * **no property, no stack capture and no allocation while it is false**. Nothing here runs in an
 * application that never asks for it, and nothing was added to the read, write, notify or subscribe
 * paths — measured against a control copy of the previous revision, the create paths move by less than
 * the benchmark's own noise (see `experiments/signal-probe/bench-hooks.mjs`).
 */

// #region trace-flag
/**
 * Opt in. `false` until then: the hooks in `src/signal.js` and `src/computed.js` compile down to a
 * boolean test, so no signal carries tracing metadata unless a debugger asked for it.
 *
 * Exactly **one** flag is checked on the creation paths; the options below only refine what an
 * already-enabled session does, so the hot check never becomes an options read.
 */
export let signalsTraced = false

/** Refinements of an active tracing session. Meaningful only while `signalsTraced` is true. */
export const traceOptions = {
  /** Capture a creation site per signal. This is the expensive part of an enabled session. */
  origin: true,
  /** Attach the listener set, so a debugger can answer "what depends on this". */
  listeners: true,
}
// #endregion trace-flag

/** `$signal[metaSymbol]` — the tracing record of a signal, attached only while tracing. */
export const metaSymbol = Symbol.for('signalMeta')

/** The protocol key a `$State` proxy answers to; probing it is how a state is recognised. */
const mergeValueSymbol = Symbol.for('signalMergeValue')

/**
 * Files of this library, as they appear in a stack frame.
 *
 * Filtering by **directory** was tried and is wrong: while running from the repository it also matches
 * test files, examples and any application under the same root, so a capture reports nothing at all.
 * Filtering by this module's own file handles the real question — "which library copy is this" — which
 * the directory was a wrong attempt at.
 */
const LIBRARY_FILES = /[\\/](?:signal|computed|state|track|observe|debug|trace|trace-signal)\.js:\d+:\d+\)?$/

/**
 * One frame that is certainly this module, captured at load time, so a capture *recognises* its own
 * helper frames instead of counting them: frame offsets differ between engines, and a debugger that
 * reports the wrong site is worse than one that reports none.
 */
const markFile = (() => {
  try {
    return (
      String(new Error().stack)
        .split('\n')[1]
        ?.match(/\(?([^()\s]+?):\d+:\d+\)?$/)?.[1] || ''
    )
  } catch {
    return ''
  }
})()

const lineFile = line => line.match(/\(?([^()\s]+?):\d+:\d+\)?$/)?.[1] || ''

const isInternal = line => {
  if (!line || line.includes('new Error')) return true
  if (markFile && line.includes(markFile)) return true
  return LIBRARY_FILES.test(line)
}

/**
 * Parse one frame.
 * @returns {{text: string, file: string, line: number, column: number, raw: string}|null}
 */
const siteOfLine = (line, raw) => {
  const m = line.match(/\(?([^()\s]+?):(\d+):(\d+)\)?$/)
  if (!m) return null
  return { text: `${m[1]}:${m[2]}:${m[3]}`, file: m[1], line: +m[2], column: +m[3], raw }
}

/**
 * Extra files that count as "internal" for a capture. A stack, not a flag: pushes and pops nest
 * correctly if a capture ever happens inside a capture.
 */
const extraInternal = []

/**
 * The frame walk. Exported so a caller that already holds a stack string can reuse the same filter
 * instead of parsing `new Error().stack` twice. `skip` skips frames on top of the `new Error()` frame;
 * this module's own frames are skipped by *identity* (`markFile`), not by position.
 *
 * @returns {{text: string, file: string, line: number, column: number, raw: string}}
 */
export const captureFrom = (raw, skip = 0) => {
  const stack = String(raw || '')
  const lines = stack.split('\n').slice(1 + skip)
  for (const line of lines) {
    if (isInternal(line)) continue
    let own = false
    for (const file of extraInternal) {
      if (line.includes(file)) {
        own = true
        break
      }
    }
    if (own) continue
    const site = siteOfLine(line, stack)
    if (site) return site
  }
  // Fallback: nothing survived the filter — a bundler may inline every library file into one chunk
  // under one filename, and then no frame is recognisable. Reporting a library frame is more useful
  // than reporting no site at all: the reader can still search the file, and `raw` carries the
  // untouched stack for anyone who wants to look at the whole thing.
  for (const line of lines) {
    if (!line || line.includes('new Error')) continue
    if (markFile && lineFile(line) === markFile) continue
    const site = siteOfLine(line, stack)
    if (site) return site
  }
  return { text: '', file: '', line: 0, column: 0, raw: stack }
}

/**
 * A creation or call site, parsed once and stored as plain data.
 *
 * `text` is `file:line:col`; `file`/`line`/`column` are kept separately so a tool can render a
 * clickable link itself. `raw` is the untouched stack.
 *
 * @returns {{text: string, file: string, line: number, column: number, raw: string}}
 */
export const captureSite = (skip = 0) => captureFrom(new Error().stack, skip)

/**
 * Capture a site while treating `files` as internal too — for a caller that captures from inside a
 * file of this library and must exclude its own frame. Using it from within the library is a smell:
 * the shared filter already knows this module, and only a caller outside can see the boundary.
 *
 * @param {string[]} files
 */
export const captureSiteSkipping = (files = []) => {
  for (const f of files) extraInternal.push(f)
  try {
    return captureSite()
  } finally {
    for (let i = files.length; i > 0; i--) extraInternal.pop()
  }
}

/** `__computed` is a marker this library sets on its computeds; typed access keeps `tsc` happy. */
const isComputed = $signal => Boolean(/** @type {any} */ ($signal)?.__computed)

/**
 * A `$State` proxy creates a **child signal for any unknown key read through it**, so probing one for
 * `__computed` would add a `__computed` field to the application's state. Every probe below therefore
 * tests for a state first.
 */
const isStateProxy = $signal => Boolean($signal && /** @type {any} */ ($signal)[mergeValueSymbol])

/** A short, printable name for a signal. */
export const describeName = $signal => {
  if (!$signal) return ''
  if (isStateProxy($signal)) return ''
  const named = $signal.label || (typeof $signal.name === 'string' ? $signal.name : '')
  if (named) return named
  return isComputed($signal) ? 'computed' : 'signal'
}

/**
 * Attach the tracing record to an existing signal.
 *
 * A **create-time** operation: it must be called right after `prepareSignal`, and only while
 * `signalsTraced` is true, because the listener set and a computed's getter must be captured before
 * anything else can subscribe. `$signal[metaSymbol]` stays absent otherwise.
 *
 * @param {Function} $signal
 * @param {{
 *   kind?: 'signal'|'computed',
 *   origin?: boolean|object, // `true` to capture a creation site here, or an already-captured site
 *   listeners?: Set|null,    // the live listener set of the signal
 *   getter?: Function,       // for a computed: the function it was built from
 *   deps?: function(): any,  // for a computed: current dependencies, as `{ tracked, declared }`
 * }} [info]
 */
export const attachTrace = ($signal, info = {}) => {
  if (!signalsTraced || !$signal) return undefined
  const record = {
    signal: $signal,
    kind: info.kind || (isComputed($signal) ? 'computed' : 'signal'),
    origin:
      info.origin && traceOptions.origin
        ? typeof info.origin === 'object'
          ? info.origin
          : captureFrom(new Error().stack)
        : null,
    listeners: traceOptions.listeners ? info.listeners || null : null,
    getter: info.getter || null,
    deps: info.deps || null,
  }
  Object.defineProperty($signal, metaSymbol, { value: record, configurable: true })
  return record
}

/** The tracing record of a signal, or `undefined` when tracing never saw it. */
export const signalTrace = $signal => {
  try {
    return $signal?.[metaSymbol]
  } catch {
    return undefined
  }
}

/**
 * Make sure `$signal` has a tracing record, attaching a minimal one if tracing has not already seen
 * it. `traceSignal` uses this so it works for a signal created *before* it was asked for.
 *
 * The retrofitted record may be incomplete: the listener set and a computed's getter are captured at
 * creation time and cannot be recovered afterwards, so such a record carries the creation site only.
 * Enable tracing at startup (`traceSignals(true)`) when complete records are wanted for signals that
 * have not been wrapped yet.
 *
 * @param {Function} $signal
 * @param {'signal'|'computed'} [kind]
 */
export const ensureTrace = ($signal, kind) => {
  // Never probe a `$State` proxy: reading an unknown key through it *creates* a child signal, so an
  // `attachTrace` here would add a `__computed` field to the application's state.
  if (isStateProxy($signal)) return undefined
  const existing = signalTrace($signal)
  if (existing) return existing
  const prev = signalsTraced
  signalsTraced = true
  try {
    return attachTrace($signal, { kind: kind || 'signal', origin: true })
  } catch {
    return undefined // a frozen function cannot carry a record; tracing must never throw
  } finally {
    signalsTraced = prev
  }
}

/** The defaults a new session starts from: everything on. */
const DEFAULT_TRACE_OPTIONS = { origin: true, listeners: true }

/**
 * Turn tracing on (or off) and report the previous state.
 *
 * Turning it **off** does not remove records that were already attached: a tool that is looking at a
 * signal right now keeps working, and a fresh page load is what clears them. A signal created while
 * tracing was on keeps its record for its whole lifetime — which is the point ("where did this come
 * from?") and also means a traced signal is never fully anonymous again.
 *
 * `traceSignals()` (or `true`) starts a session with the **defaults restored**: options belong to a
 * session, not to the process, so an earlier `{origin: false}` cannot silently degrade a later one.
 * Pass an object to choose them: `traceSignals({origin: false})`.
 *
 * @param {boolean|{origin?: boolean, listeners?: boolean}} [on] `true`/`false`, or options for a session
 * @returns {boolean} the previous state
 */
export const traceSignals = (on = true) => {
  const prev = signalsTraced
  if (on && typeof on === 'object') {
    if (on.origin !== undefined) traceOptions.origin = !!on.origin
    if (on.listeners !== undefined) traceOptions.listeners = !!on.listeners
    signalsTraced = true
  } else {
    if (on) {
      traceOptions.origin = DEFAULT_TRACE_OPTIONS.origin
      traceOptions.listeners = DEFAULT_TRACE_OPTIONS.listeners
    }
    signalsTraced = !!on
  }
  return prev
}
