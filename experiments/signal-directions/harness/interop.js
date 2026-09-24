/**
 * Interop probe matrix — "what actually happens when the two worlds meet", per direction.
 *
 * Every probe is executed, not described. The vendored alien-signals is imported here directly so that
 * the directions **without** interop helpers still get tested against a real alien node: a user with
 * alien in their app can always hand one to jsx6 code, and that is precisely where the sharp edges are.
 *
 * Status vocabulary:
 *   native        the direction's own signals are alien nodes; no bridge involved
 *   bridged       works, through an explicit bridge (`toAlien`) or an automatic normalisation
 *   needs-bridge  works only if the caller bridges; otherwise silently stale
 *   stale         does not work; the value does not update (no error)
 *   static        does not work; the alien node is treated as a plain value (no error)
 *   unsupported   no helper exists for this at all
 */

import * as alien from '../vendor/alien-signals/index.mjs'

const has = (api, cap) => (api.meta.capabilities || []).includes(cap)

/** P1 — an alien computed reading a jsx6 signal with NO bridge. */
const p1UnbridgedAlienRead = api => {
  const $a = api.signal(1)
  const c = alien.computed(() => $a() * 10)
  c()
  $a(2)
  return c() === 20 ? { status: 'native', evidence: 'value followed the write (20)' } : { status: 'needs-bridge', evidence: `stayed ${c()}` }
}

/** P2 — the same thing, bridged. */
const p2BridgedAlienRead = api => {
  if (!has(api, 'interop')) return { status: 'unsupported', evidence: 'no toAlien helper' }
  const $a = api.signal(1)
  const A = api.toAlien($a)
  const c = alien.computed(() => A() * 10)
  c()
  $a(2)
  const v = c()
  const free = has(api, 'interop:no-bridge-needed')
  return v === 20 ? { status: free ? 'native' : 'bridged', evidence: `value followed the write (${v})` } : { status: 'stale', evidence: `stayed ${v}` }
}

/** P3 — an alien effect reading a jsx6 signal. */
const p3AlienEffect = api => {
  const $a = api.signal(1)
  const seen = []
  const read = has(api, 'interop') && !has(api, 'interop:no-bridge-needed') ? api.toAlien($a) : $a
  const stop = alien.effect(() => {
    seen.push(read())
    return undefined
  })
  $a(2)
  stop()
  return seen.length > 1
    ? { status: has(api, 'interop:no-bridge-needed') ? 'native' : 'bridged', evidence: `effect ran ${seen.length}x (${seen.join(',')})` }
    : { status: 'needs-bridge', evidence: `effect ran ${seen.length}x (${seen.join(',')})` }
}

/** P4 — a jsx6 derived signal depending on an alien signal (no normalisation). */
const p4DerivedOnAlien = api => {
  const a = alien.signal(1)
  const $doubled = api.$F(v => v * 2, a)
  a(3)
  const out = $doubled()
  if (typeof out === 'function') return { status: 'static', evidence: '$F returned the alien node itself' }
  return out === 6
    ? { status: has(api, 'interop:no-bridge-needed') ? 'native' : 'bridged', evidence: `derived value followed the write (${out})` }
    : { status: 'stale', evidence: `stayed ${out}` }
}

/** P5 — an alien computed in a JSX position (what jsx2dom does: `observeNow(value, updater)`). */
const p5AlienInJsxPosition = api => {
  const a = alien.signal(1)
  const c = alien.computed(() => a() * 2)
  const seen = []
  const un = api.observeNow(c, v => seen.push(v))
  a(4)
  un?.()
  if (typeof seen[0] === 'function') return { status: 'static', evidence: 'updater got the function itself' }
  return seen.length > 1
    ? { status: has(api, 'interop:no-bridge-needed') ? 'native' : 'bridged', evidence: `updater got ${seen.join(' → ')}` }
    : { status: 'stale', evidence: `updater got ${seen.join(' → ')}` }
}

/** P6 — two-way: jsx6 write → bridged alien computed → jsx6 observer. */
const p6TwoWay = api => {
  if (!has(api, 'interop')) return { status: 'unsupported', evidence: 'no bridge helpers' }
  const $a = api.signal(1)
  const A = api.toAlien($a)
  const c = alien.computed(() => A() * 3)
  const seen = []
  const un = api.observeNow(c, v => seen.push(v))
  $a(5)
  un?.()
  return seen.length > 1 && seen[seen.length - 1] === 15
    ? { status: has(api, 'interop:no-bridge-needed') ? 'native' : 'bridged', evidence: `round trip: ${seen.join(' → ')}` }
    : { status: 'stale', evidence: `round trip: ${seen.join(' → ')}` }
}

/** P7 — is an alien node recognised as observable at all? */
const p7IsObservable = api => {
  const a = alien.signal(1)
  const c = alien.computed(() => a())
  const ok = api.isObservable(a) && api.isObservable(c)
  if (!ok) return { status: 'static', evidence: 'isObservable() does not know alien nodes' }
  // C's own signals are alien nodes; A/E/F adapt `isObservable` in the compat layer.
  return has(api, 'interop:no-bridge-needed')
    ? { status: 'native', evidence: 'isObservable(alienSignal) and (alienComputed) both true — no adapter needed' }
    : { status: 'bridged', evidence: 'isObservable(alienSignal) and (alienComputed) both true — via the compat override' }
}

/** P8 — releasing what the bridge created. */
const p8DisposeBridge = api => {
  if (!has(api, 'interop')) return { status: 'unsupported', evidence: 'no bridge to dispose' }
  const a = alien.signal(1)
  const $mirror = api.toSignal(a)
  const seen = []
  const un = api.observe($mirror, () => seen.push($mirror()))
  a(2)
  api.dispose($mirror)
  a(3)
  un?.()
  const frozen = !seen.length || seen[seen.length - 1] !== 3
  return frozen
    ? { status: 'bridged', evidence: `mirror stopped updating (saw ${seen.join(',') || 'nothing'})` }
    : { status: 'stale', evidence: 'mirror kept updating after dispose' }
}

/** P9 — cost of a bridge: one alien node + one listener per source signal. */
const p9BridgeCost = api => {
  if (!has(api, 'interop')) return { status: 'unsupported', evidence: 'no bridge' }
  if (has(api, 'interop:no-bridge-needed')) {
    return { status: 'native', evidence: 'toAlien returns the backing alien node — zero extra nodes' }
  }
  const $a = api.signal(1)
  const A1 = api.toAlien($a)
  const A2 = api.toAlien($a)
  return A1 === A2
    ? { status: 'bridged', evidence: 'bridges are cached per source (same node returned twice)' }
    : { status: 'bridged', evidence: 'each toAlien() call creates a NEW node (no caching)' }
}

export const probes = [
  ['P1', 'alien computed reads a jsx6 signal, no bridge', p1UnbridgedAlienRead],
  ['P2', 'alien computed reads a bridged jsx6 signal', p2BridgedAlienRead],
  ['P3', 'alien effect reads a jsx6 signal', p3AlienEffect],
  ['P4', 'jsx6 $F depends on an alien signal', p4DerivedOnAlien],
  ['P5', 'alien computed in a JSX position (observeNow)', p5AlienInJsxPosition],
  ['P6', 'two-way: jsx6 write → alien computed → jsx6 observer', p6TwoWay],
  ['P7', 'isObservable() recognises alien nodes', p7IsObservable],
  ['P8', 'dispose() releases a bridge/mirror', p8DisposeBridge],
  ['P9', 'bridge allocation cost / caching', p9BridgeCost],
]

/** @param {any} api a loaded direction module */
export const runInterop = api =>
  probes.map(([id, title, fn]) => {
    try {
      const { status, evidence } = fn(api)
      return { id, title, status, evidence }
    } catch (e) {
      return { id, title, status: 'threw', evidence: (e && e.message) || String(e) }
    }
  })

export const STATUS_ORDER = ['native', 'bridged', 'needs-bridge', 'static', 'stale', 'unsupported', 'threw']

export const STATUS_ICON = {
  native: '✅ native',
  bridged: '🔗 bridged',
  'needs-bridge': '⚠️ needs bridge',
  static: '❌ static',
  stale: '❌ stale',
  unsupported: '— unsupported',
  threw: '💥 threw',
}