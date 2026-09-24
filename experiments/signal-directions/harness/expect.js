/**
 * Minimal assertion helpers for the direction harness.
 *
 * Deliberately not `bun:test`: the harness must be runnable both from `bun test` (for the copied
 * baseline suites) and from a plain `bun run` script that produces the comparison table, and the
 * comparison runner needs to collect failures per direction instead of aborting on the first one.
 */

export class AssertionError extends Error {}

export const ok = (value, message) => {
  if (!value) throw new AssertionError(message || `expected truthy, got ${format(value)}`)
}

export const eq = (actual, expected, message) => {
  if (!Object.is(actual, expected)) {
    throw new AssertionError(
      `${message ? message + ': ' : ''}expected ${format(expected)}, got ${format(actual)}`,
    )
  }
}

export const deepEq = (actual, expected, message) => {
  const a = canonical(actual)
  const b = canonical(expected)
  if (a !== b) throw new AssertionError(`${message ? message + ': ' : ''}expected ${b}, got ${a}`)
}

/** Key-order-insensitive structural comparison (plain objects/arrays/Set/Map values only). */
const canonical = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value instanceof Set) return `Set(${[...value].map(canonical).map(String).sort().join(',')})`
  if (value instanceof Map)
    return `Map(${[...value.entries()]
      .map(([k, v]) => `${canonical(k)}=>${canonical(v)}`)
      .sort()
      .join(',')})`
  const keys = Object.keys(value).sort()
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
}

export const throws = (fn, message) => {
  let threw = false
  try {
    fn()
  } catch {
    threw = true
  }
  if (!threw) throw new AssertionError(message || 'expected the call to throw')
}

export const notThrows = (fn, message) => {
  try {
    fn()
  } catch (e) {
    throw new AssertionError(`${message || 'expected no throw'}: threw ${e && e.message}`)
  }
}

/** Rejects if `fn` throws — used for "this must not crash" cases (the cleanup footgun). */
export const settles = async (fn, message) => {
  try {
    return await fn()
  } catch (e) {
    throw new AssertionError(`${message || 'expected no throw'}: threw ${e && e.message}`)
  }
}

const format = v => {
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'function') return `<fn ${v.name || 'anonymous'}>`
  if (v === undefined) return 'undefined'
  if (v === null) return 'null'
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}
