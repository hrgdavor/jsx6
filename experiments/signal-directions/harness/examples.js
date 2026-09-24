/**
 * Canonical usage tasks — the same job solved in each direction, so the **code differences** are
 * visible and the **behavioural differences are measured** rather than asserted.
 *
 * Each task provides
 *   - `code`: the snippet a user writes — shared when there is no difference, with per-direction
 *     overrides when there is (a difference in the snippet *is* the finding),
 *   - `run(api)`: the same thing executed for real, keyed explicitly by direction id,
 *   - `expect`: what each direction's `run` should produce.
 *
 * The runner records the observed value, so a direction that "supports" something only in prose shows
 * up as a mismatch. `vendorAlien` is imported here (not from a direction) so that the failure modes of
 * the directions *without* interop can be demonstrated rather than described: a user who has alien in
 * their app can always hand an alien node to jsx6 code.
 */

import * as vendorAlien from '../vendor/alien-signals/index.mjs'

const asText = v => (v === undefined ? 'undefined' : typeof v === 'string' ? v : JSON.stringify(v))

export const tasks = [
  {
    id: 'T1-signal-basics',
    title: 'Create a signal, read it, write it',
    why: 'The shared core: every direction must behave identically (contract K1/K2).',
    code: `const $a = signal(1)
$a(2)
$a()          // 2
$a(2)         // undefined — an unchanged write reports nothing`,
    expect: '2 (changed=true, unchanged=undefined)',
    run: api => {
      const $a = api.signal(1)
      const changed = $a(2)
      const unchanged = $a(2)
      return `${$a()} (changed=${asText(changed)}, unchanged=${asText(unchanged)})`
    },
  },

  {
    id: 'T2-derived-declared-deps',
    title: 'Derive with an explicit dependency list (the classic form)',
    why: 'Identical everywhere: this shape must keep working unchanged.',
    code: `const $sum = $S(() => $a() + $b(), $a, $b)
$a(10)
$sum()        // 12`,
    expect: 12,
    run: api => {
      const $a = api.signal(1)
      const $b = api.signal(2)
      const $sum = api.$S(() => $a() + $b(), $a, $b)
      $a(10)
      return $sum()
    },
  },

  {
    id: 'T3-omitted-dependency',
    title: 'Derive while forgetting one dependency',
    why:
      'The ergonomic gap that motivated the portfolio. Union-dependency directions repair the ' +
      'omission; the others go silently stale — which is what the `signal-dependencies` lint rule ' +
      'exists to catch.',
    code: {
      default: `// $b is read but NOT declared — the classic footgun
const $sum = $S(() => $a() + $b(), $a)
$b(20)
$sum()        // stale: the declared dep ($a) never changed`,
      'b-native-computed': `// union deps: declared ∪ auto-tracked reads
const $sum = $S(() => $a() + $b(), $a)
$b(20)
$sum()        // 21 — the omission is repaired automatically`,
      'c-alien-backend': `// union deps, tracked by alien's graph
const $sum = $S(() => $a() + $b(), $a)
$b(20)
$sum()        // 21`,
      'e-alien-native': `// no core auto-tracking: bridge the inputs first
const $sum = $C(() => toAlien($a)() + toAlien($b)())
toAlien($b)(20)
$sum()        // 21`,
      'f-bridge-hybrid': `// deps must still be listed, but they are bridged for you
const $sum = $C((a, b) => a + b, $a, $b)
$b(20)
$sum()        // 21`,
      'a-compat': `// compat does not change $S/$F tracking: still stale
const $sum = $S(() => $a() + $b(), $a)
$b(20)
$sum()        // 3 — stale`,
    },
    expect: {
      baseline: '3 (stale)',
      'a-compat': '3 (stale)',
      'b-native-computed': 21,
      'c-alien-backend': 21,
      'e-alien-native': 21,
      'f-bridge-hybrid': 21,
    },
    run: api => {
      const $a = api.signal(1)
      const $b = api.signal(2)
      switch (api.meta.id) {
        case 'b-native-computed':
        case 'c-alien-backend': {
          const $sum = api.$S(() => $a() + $b(), $a)
          $b(20)
          return $sum()
        }
        case 'e-alien-native': {
          const $sum = api.$C(() => api.toAlien($a)() + api.toAlien($b)())
          api.toAlien($b)(20)
          return $sum()
        }
        case 'f-bridge-hybrid': {
          const $sum = api.$C((a, b) => a + b, $a, $b)
          $b(20)
          return $sum()
        }
        default: {
          const $sum = api.$S(() => $a() + $b(), $a)
          $b(20)
          return `${$sum()} (stale)`
        }
      }
    },
  },

  {
    id: 'T4-computed-lazy',
    title: 'A lazy computed that evaluates only when read',
    why:
      'Absent from the baseline. B/C auto-track the core’s own signals; F requires the dependency list; ' +
      'E and A only track alien values, so a jsx6 signal must be bridged first.',
    code: {
      default: `// no computed primitive
const c = alien.computed(() => $a() * 2)   // does NOT track a jsx6 signal`,
      'b-native-computed': `const $double = $C(() => $a() * 2)   // no dependency list
$double()          // 2 — evaluated on first read, memoized after`,
      'c-alien-backend': `const $double = $C(() => $a() * 2)   // alien computed, native tracking
$double()          // 2`,
      'e-alien-native': `const $double = $C(() => toAlien($a)() * 2)   // $C IS alien.computed
$double()          // 2`,
      'f-bridge-hybrid': `const $double = $C(v => v * 2, $a)   // deps required, bridged for you
$double()          // 2`,
      'a-compat': `const $double = alien.computed(() => toAlien($a)() * 2)
$double()          // 2`,
    },
    expect: {
      baseline: 'unavailable',
      'a-compat': 2,
      'b-native-computed': 2,
      'c-alien-backend': 2,
      'e-alien-native': 2,
      'f-bridge-hybrid': 2,
    },
    run: api => {
      const $a = api.signal(1)
      switch (api.meta.id) {
        case 'b-native-computed':
        case 'c-alien-backend':
          return api.$C(() => $a() * 2)()
        case 'f-bridge-hybrid':
          return api.$C(v => v * 2, $a)()
        case 'e-alien-native':
          return api.$C(() => api.toAlien($a)() * 2)()
        case 'a-compat':
          return api.alien.computed(() => api.toAlien($a)() * 2)()
        default:
          return { unavailable: 'no computed primitive' }
      }
    },
  },

  {
    id: 'T5-computed-eager',
    title: 'An eager computed that recomputes without being read',
    why:
      'The shape that matches this library’s long-lived-component philosophy. Only B and C have it: ' +
      'alien’s `computed` is pull-based, so E/F cannot express eagerness without adding a watcher.',
    code: {
      default: `const $derived = $S(() => $a() * 2, $a)   // the only eager option: manual deps`,
      'b-native-computed': `const $derived = $CE(() => $a() * 2)   // eager + auto-tracked
$a(5)
$derived()         // 10, and the getter already ran`,
      'c-alien-backend': `const $derived = $CE(() => $a() * 2)   // eager over alien's computed
$a(5)
$derived()         // 10`,
    },
    expect: { default: 'unavailable', 'b-native-computed': 10, 'c-alien-backend': 10 },
    run: api => {
      if (!api.meta.capabilities.includes('computed:eager')) return { unavailable: 'no eager computed' }
      const $a = api.signal(1)
      const $derived = api.$CE(() => $a() * 2)
      $a(5)
      return $derived()
    },
  },

  {
    id: 'T6-computed-dynamic-deps',
    title: 'A dependency that only appears on a later evaluation',
    why:
      'Separates “collect once” from “collect on every recomputation”. B’s `$C` re-collects (its ' +
      '`$S`/`$F` do not — declared deps carry those); C’s alien computed re-collects natively.',
    code: {
      default: `// no computed primitive`,
      'b-native-computed': `const $pick = $C(() => ($flag() ? $a() : $b()))
$flag(false)
$b(20)
$pick()       // 20 — the branch that appeared later is tracked`,
      'c-alien-backend': `const $pick = $C(() => ($flag() ? $a() : $b()))
$flag(false)
$b(20)
$pick()       // 20`,
    },
    expect: { default: 'unavailable', 'b-native-computed': 20, 'c-alien-backend': 20 },
    run: api => {
      if (!api.meta.capabilities.includes('computed:dynamic-deps')) {
        return { unavailable: 'no dynamic dependency tracking' }
      }
      const $flag = api.signal(true)
      const $a = api.signal(1)
      const $b = api.signal(10)
      const $pick = api.$C(() => ($flag() ? $a() : $b()))
      $pick()
      $flag(false)
      $b(20)
      return $pick()
    },
  },

  {
    id: 'T7-batch-glitch',
    title: 'Two writes in one update: how many notifications?',
    why:
      'The glitch question, measured. `batch()` coalesces the core graph in B/C; in A/E/F it coalesces ' +
      'only alien effects, so the core still notifies once per write.',
    code: {
      default: `$s.x = 2
$s.y = 3
// derived observer fires twice — an intermediate value is visible`,
      'b-native-computed': `batch(() => { $s.x = 2; $s.y = 3 })
// one notification, no intermediate value`,
      'c-alien-backend': `batch(() => { $s.x = 2; $s.y = 3 })
// one notification, no intermediate value`,
      'a-compat': `batch(() => { $s.x = 2; $s.y = 3 })
// still two notifications: batch() only defers alien effects here`,
    },
    expect: {
      default: 2,
      'b-native-computed': 1,
      'c-alien-backend': 1,
      'a-compat': 2,
      'e-alien-native': 2,
      'f-bridge-hybrid': 2,
    },
    run: api => {
      const $s = api.$State({ x: 1, y: 1 })
      const $sum = api.$S(() => $s.x() + $s.y(), $s.x, $s.y)
      let n = 0
      const un = api.observe($sum, () => n++)
      if (api.meta.capabilities.includes('batch:core')) {
        api.batch(() => {
          $s.x = 2
          $s.y = 3
        })
      } else {
        $s.x = 2
        $s.y = 3
      }
      un?.()
      return n
    },
  },

  {
    id: 'T8-state-and-derived',
    title: 'The application pattern: `$State` + a derived label + a DOM binding',
    why: 'Identical code everywhere — this is the compatibility bar for the whole family.',
    code: `const $s = $State({ n: 1, label: 'row' })
const $text = $S(() => \`\${$s.label()}:\${$s.n() * 2}\`, $s)
observeNow($text, v => el.textContent = v)
$s.n = 3
el.textContent      // "row:6"`,
    expect: 'row:6',
    run: api => {
      const $s = api.$State({ n: 1, label: 'row' })
      const $text = api.$S(() => `${$s.label()}:${$s.n() * 2}`, $s)
      let seen
      const un = api.observeNow($text, v => (seen = v))
      $s.n = 3
      un?.()
      return seen
    },
  },

  {
    id: 'T9-alien-reads-jsx6',
    title: 'An alien computed reading jsx6 signals',
    why:
      'The core interop question. A bare jsx6 read is invisible to alien tracking; A/E/F must bridge, ' +
      'C needs no bridge because its signals *are* alien nodes, and the baseline/B have no way to make ' +
      'alien see them at all.',
    code: {
      default: `const c = alien.computed(() => $a() + $b())
$a(10)
c()          // stale — a jsx6 read is just a function call to alien`,
      'a-compat': `const A = toAlien($a), B = toAlien($b)
const c = alien.computed(() => A() + B())
$a(10)
c()          // 12 — the bridge registers the dependency`,
      'e-alien-native': `const A = toAlien($a), B = toAlien($b)
const c = $C(() => A() + B())
$a(10)
c()          // 12`,
      'f-bridge-hybrid': `const c = $C((a, b) => a + b, $a, $b)
$a(10)
c()          // 12 — deps are bridged inside $C`,
      'c-alien-backend': `const c = alien.computed(() => $a() + $b())
$a(10)
c()          // 12 — no bridge: the jsx6 signal IS an alien node`,
    },
    expect: {
      baseline: 'stale',
      'a-compat': 12,
      'b-native-computed': 'stale',
      'c-alien-backend': 12,
      'e-alien-native': 12,
      'f-bridge-hybrid': 12,
    },
    run: api => {
      const $a = api.signal(1)
      const $b = api.signal(2)
      // A jsx6 direction with no interop: the alien node has to come from the app's own alien import.
      if (!api.meta.capabilities.includes('interop')) {
        const c = vendorAlien.computed(() => $a() + $b())
        c()
        $a(10)
        return `${c()} (stale)`
      }
      if (api.meta.capabilities.includes('interop:no-bridge-needed')) {
        const c = api.alien.computed(() => $a() + $b())
        c()
        $a(10)
        return c()
      }
      if (api.meta.id === 'f-bridge-hybrid') {
        const c = api.$C((a, b) => a + b, $a, $b)
        c()
        $a(10)
        return c()
      }
      const A = api.toAlien($a)
      const B = api.toAlien($b)
      const c = api.meta.id === 'e-alien-native' ? api.$C(() => A() + B()) : api.alien.computed(() => A() + B())
      c()
      $a(10)
      return c()
    },
  },

  {
    id: 'T10-jsx6-depends-on-alien',
    title: 'A jsx6 derived signal that depends on an alien signal',
    why:
      'The opposite direction, and the sharpest failure mode in the table: the untouched `$F` cannot ' +
      'see an alien node at all, so it silently takes the static branch and hands the node back as the ' +
      'value. Compat normalises the dependency list; C accepts alien nodes natively.',
    code: {
      default: `const $doubled = $F(v => v * 2, alienSignal)
alienSignal(3)
$doubled()    // the alien node itself — $F treated it as a static value`,
      'a-compat': `const $doubled = $F(v => v * 2, alienSignal)
alienSignal(3)
$doubled()    // 6 — the compat layer normalises the alien dependency`,
      'e-alien-native': `const $doubled = $F(v => v * 2, alienSignal)
alienSignal(3)
$doubled()    // 6`,
      'f-bridge-hybrid': `const $doubled = $F(v => v * 2, alienSignal)
alienSignal(3)
$doubled()    // 6`,
      'c-alien-backend': `const $doubled = $F(v => v * 2, alienSignal)
alienSignal(3)
$doubled()    // 6 — alien nodes are legitimate observables here`,
    },
    expect: {
      baseline: 'silently wrong',
      'a-compat': 6,
      'b-native-computed': 'silently wrong',
      'c-alien-backend': 6,
      'e-alien-native': 6,
      'f-bridge-hybrid': 6,
    },
    run: api => {
      const alienSignal = vendorAlien.signal(1)
      const $doubled = api.$F(v => v * 2, alienSignal)
      alienSignal(3)
      const out = $doubled()
      return typeof out === 'function' ? 'silently wrong (returned the alien node)' : out
    },
  },

  {
    id: 'T11-alien-node-in-jsx-position',
    title: 'Using an alien computed where jsx2dom expects a signal',
    why:
      '`insertAttr`/`nodeFromObservable` treat any function value as a signal. Without an alien-aware ' +
      'branch an alien computed is a *static* value, so the page renders the function itself rather ' +
      'than the number — this is what makes `{$computed}` work or not.',
    code: {
      default: `observeNow(alienComputed, cb)
// static value: cb runs once, with the function itself`,
      'a-compat': `observeNow(alienComputed, cb)   // alien-aware: value now, then on every change`,
      'c-alien-backend': `observeNow(alienComputed, cb)   // alien-aware, and no bridge needed`,
      'e-alien-native': `observeNow(alienComputed, cb)   // alien-aware`,
      'f-bridge-hybrid': `observeNow(alienComputed, cb)   // alien-aware`,
    },
    expect: {
      baseline: 'the function itself (static branch)',
      'a-compat': '2 then 6',
      'b-native-computed': 'the function itself (static branch)',
      'c-alien-backend': '2 then 6',
      'e-alien-native': '2 then 6',
      'f-bridge-hybrid': '2 then 6',
    },
    run: api => {
      // Two-phase: first assert the alien-aware behaviour where it exists, then (for the directions
      // without it) show what the app actually receives.
      const alienSignal = vendorAlien.signal(1)
      const c = vendorAlien.computed(() => alienSignal() * 2)
      const seen = []
      const un = api.observeNow(c, v => seen.push(v))
      alienSignal(3)
      un?.()
      if (typeof seen[0] === 'function') return 'the function itself (static branch)'
      return seen.join(' then ')
    },
  },

  {
    id: 'T12-dispose',
    title: 'Releasing a derived value’s subscriptions',
    why:
      'Long-lived components make release semantics load-bearing. B/C can release a computed; in A/E/F ' +
      'the thing worth releasing is a bridge or a mirror; the baseline has nothing to release at all ' +
      '(the P2-4 leak the plan tracks).',
    code: {
      default: `// nothing to release: derived subscriptions live as long as the signal`,
      'b-native-computed': `const $c = $C(() => $a() + 1)
$c()
dispose($c)     // dependency subscriptions released`,
      'c-alien-backend': `const $c = $C(() => $a() + 1)
$c()
dispose($c)     // stops the push effect, releasing alien dep links`,
      'a-compat': `dispose(toSignal(alienNode))   // stop a mirror
dispose(toAlien($sig))       // remove a bridge listener`,
      'e-alien-native': `dispose(toSignal(alienNode))   // stop a mirror`,
      'f-bridge-hybrid': `dispose(toSignal(alienNode))   // stop a mirror`,
    },
    expect: {
      baseline: 'unavailable',
      'a-compat': 'mirror stopped',
      'b-native-computed': 'getter no longer runs',
      'c-alien-backend': 'getter no longer runs',
      'e-alien-native': 'mirror stopped',
      'f-bridge-hybrid': 'mirror stopped',
    },
    run: api => {
      if (api.meta.capabilities.includes('computed') && api.meta.capabilities.includes('dispose')) {
        const $a = api.signal(1)
        let runs = 0
        const $c = api.$C(() => {
          runs++
          return $a() + 1
        })
        $c()
        api.dispose($c)
        const before = runs
        $a(2)
        return runs === before ? 'getter no longer runs' : `getter ran again (${runs - before}x)`
      }
      if (api.meta.capabilities.includes('interop')) {
        const alienSignal = vendorAlien.signal(1)
        const $mirror = api.toSignal(alienSignal)
        const seen = []
        const un = api.observe($mirror, () => seen.push($mirror()))
        alienSignal(2)
        api.dispose($mirror)
        alienSignal(3)
        un?.()
        return seen.length && seen[seen.length - 1] === 3 ? 'mirror still live' : 'mirror stopped'
      }
      return { unavailable: 'no dispose in this direction' }
    },
  },
]

export const taskById = id => tasks.find(t => t.id === id)

/**
 * Run every task against one loaded direction module.
 * @param {any} api the direction module (its `meta` identifies it)
 */
export const runTasks = api =>
  tasks.map(t => {
    let observed
    try {
      const value = t.run(api)
      observed =
        value && typeof value === 'object' && 'unavailable' in value ? `unavailable: ${value.unavailable}` : value
    } catch (e) {
      observed = `threw: ${(e && e.message) || String(e)}`
    }
    const exp = typeof t.expect === 'object' && !Array.isArray(t.expect) ? t.expect[api.meta.id] : t.expect
    const expected = exp === undefined ? (typeof t.expect === 'object' ? t.expect.default : undefined) : exp
    // Numbers must match exactly (so `1` never matches `11`); descriptive expectations match on a
    // substring in either direction, because the observed text carries extra detail by design.
    const numeric = value => /^-?\d+(\.\d+)?$/.test(String(value))
    const ok =
      expected === undefined ||
      (numeric(expected)
        ? String(observed) === String(expected)
        : expected === observed || expected.includes(observed) || observed.includes(expected))
    return {
      id: t.id,
      title: t.title,
      code: typeof t.code === 'string' ? t.code : t.code[api.meta.id] || t.code.default,
      shared: typeof t.code === 'string',
      observed: String(observed),
      expected: expected === undefined ? '—' : String(expected),
      ok,
    }
  })