/**
 * Debugging utilities for signals — `console.log($count)` that shows a value.
 *
 * ## Why this exists
 *
 * A signal is a function, and Chrome (and Node's inspector) render a function value as source text:
 * they list none of the function's own properties, so a `value` getter on a signal is invisible, and
 * DevTools does not run custom formatters for function values either. The only shapes DevTools will
 * format are proxies — which is what `setInspectable(true)` provides, at a measured ~13× cost on the
 * read path (see `src/devtools.js`).
 *
 * Intercepting the console avoids both problems:
 *
 *   - the call site is unchanged — `console.log('count', $count)` stays exactly as written;
 *   - there is no cost on any signal path, only on the logging call itself;
 *   - it works in every browser and in Node, with no DevTools setting.
 *
 * ```js
 * import { installConsoleInspection } from '@jsx6/signal'
 * if (import.meta.env?.DEV) installConsoleInspection()
 *
 * console.log('count is', $count)     // count is {signal: '$count', kind: 'signal', value: 5, …}
 * ```
 *
 * ## The one trade-off
 *
 * Wrapping a console method moves DevTools' own "logged from" attribution to the wrapper — every entry
 * would point at this file instead of yours. Two ways out, both available:
 *
 *   - `showCallSite: true` appends the real caller location as text, so the information is not lost;
 *   - the original method stays reachable as `console.log.original(...)`, for the cases where DevTools'
 *     clickable source link matters more than the value being readable.
 */

import { subscribeSymbol } from './observe.js'

const MERGE_VALUE = Symbol.for('signalMergeValue')
const STATE_CHILDREN = Symbol.for('signalStateChildren')
const INTERNAL_NAMES = /^\$(signal|computed|state)$/

/** A signal, a computed, a `$State` proxy or a `staticSignal`: all carry the subscribe protocol. */
export const isSignalish = obj => {
  try {
    return typeof obj === 'function' && typeof obj[subscribeSymbol] === 'function'
  } catch {
    return false
  }
}

/** `signal`, `computed` or `$State`. */
export const signalKind = obj => {
  try {
    if (typeof obj[MERGE_VALUE] === 'function' || obj[STATE_CHILDREN]) return '$State'
    if (obj.__computed) return 'computed'
    return 'signal'
  } catch {
    return 'signal'
  }
}

/**
 * The label of a signal, read **without** triggering a getter: `$State` is a proxy whose `get` trap
 * creates a child signal for any unknown key, so `obj.name` would add a field to the state. Property
 * descriptors go to the target and invoke no trap. The library's own closures are named `$signal` /
 * `$computed` and are filtered out.
 */
export const signalName = obj => {
  try {
    for (const key of ['label', 'name']) {
      const value = Object.getOwnPropertyDescriptor(obj, key)?.value
      if (typeof value === 'string' && value && !INTERNAL_NAMES.test(value)) return value
    }
    return ''
  } catch {
    return ''
  }
}

/** Reads the current value, never throwing: a broken or cyclic signal still has to be inspectable. */
export const readSignal = obj => {
  try {
    return { value: obj() }
  } catch (e) {
    return { error: (e instanceof Error && e.message) || String(e) }
  }
}

const asText = value => {
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === undefined) return 'undefined'
  if (typeof value === 'function') return 'ƒ (call it for the value)'
  if (value !== null && typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/**
 * A plain, always-renderable description of a signal. Plain objects are shown with their own properties
 * by every console, which is what makes the value visible.
 *
 * @param {Function} signal
 * @param {string} [name] defaults to the signal's own label/name
 */
export const describeSignal = (signal, name) => {
  const { value, error } = readSignal(signal)
  return {
    signal: name || signalName(signal) || 'signal',
    kind: signalKind(signal),
    value: error ? `⚠ ${error}` : value,
    read: () => signal(),
    raw: signal,
  }
}

/** One-line form: `signal $count = 5`. Used by `describeSignal`'s string mode and by formatters. */
export const signalLabel = signal => {
  const { value, error } = readSignal(signal)
  const name = signalName(signal)
  return `${signalKind(signal)}${name ? ` ${name}` : ''} = ${error ? `⚠ ${error}` : asText(value)}`
}

const DEFAULT_METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace']

/** The first stack frame outside this file — the developer's own call site. */
const callerSite = () => {
  try {
    const lines = String(new Error().stack).split('\n')
    for (const line of lines) {
      if (!line || line.includes('debug.js') || line.includes('new Error')) continue
      const m = line.match(/([^/\\():]+:\d+:\d+)/)
      if (m) return m[1]
    }
  } catch {
    /* ignore */
  }
  return ''
}

/**
 * Replace signal arguments with a readable description, in `console.log`/`warn`/… themselves.
 *
 * @param {{
 *   console?: object,
 *   methods?: string[],
 *   asString?: boolean,
 *   showCallSite?: boolean,
 * }} [options]
 * @returns {() => void} uninstall
 */
export const installConsoleInspection = (options = {}) => {
  const target = options.console ?? globalThis.console
  const methods = options.methods ?? DEFAULT_METHODS
  const asString = options.asString ?? false
  const showCallSite = options.showCallSite ?? false
  if (!target) return () => {}

  const installed = []
  for (const name of methods) {
    const original = target[name]
    // Only real console methods, never our own wrapper, and never twice.
    if (typeof original !== 'function' || original.__jsx6ConsoleInspection) continue

    const wrapped = function (...args) {
      let replaced = false
      const mapped = args.map(arg => {
        if (!isSignalish(arg)) return arg
        replaced = true
        return asString ? signalLabel(arg) : describeSignal(arg)
      })
      if (replaced && showCallSite) {
        const site = callerSite()
        if (site) mapped.push(`(logged from ${site})`)
      }
      return original.apply(target, mapped)
    }
    wrapped.__jsx6ConsoleInspection = true
    wrapped.original = original
    target[name] = wrapped
    installed.push([name, original])
  }

  const uninstall = () => {
    for (const [name, original] of installed) {
      if (target[name] === original) continue
      if (target[name]?.__jsx6ConsoleInspection) target[name] = original
    }
    installed.length = 0
  }
  return uninstall
}

/** Removes the wrappers from a console, if they are installed. */
export const uninstallConsoleInspection = (target = globalThis.console) => {
  if (!target) return false
  let removed = false
  for (const name of DEFAULT_METHODS) {
    const method = target[name]
    if (method && method.__jsx6ConsoleInspection && method.original) {
      target[name] = method.original
      removed = true
    }
  }
  return removed
}

/** @returns {boolean} whether this console currently has the inspection wrappers installed */
export const hasConsoleInspection = (target = globalThis.console) =>
  Boolean(target && DEFAULT_METHODS.some(name => target[name]?.__jsx6ConsoleInspection))
