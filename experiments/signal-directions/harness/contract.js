/**
 * The frozen comparison contract.
 *
 * Every direction module is loaded by path and exercised through this single list, so that results
 * are comparable. A case declares the capabilities it needs; a direction that does not claim them is
 * recorded as `skipped` (which is itself a reported outcome — "no computed at all" is a fact about a
 * direction, not a failure).
 *
 * Capability names:
 *   core            baseline public API (always expected)
 *   union-deps      $S/$F honour declared deps AND auto-tracked reads
 *   computed        $C exists and works with explicit dependencies
 *   computed:auto   $C auto-tracks reads (no dependency list)
 *   computed:eager  $CE exists (eager computed)
 *   batch           batch(fn) exists and coalesces
 *   dispose         a computed can release its dependency subscriptions
 *   interop         toAlien/toSignal/isAlienSignal/isAlienComputed + alien-aware observe
 *   alien-core      marker: the core's storage/graph is alien-signals (reported, not asserted)
 */

import { AssertionError, deepEq, eq, notThrows, ok } from './expect.js'

const wait = () => new Promise(r => setTimeout(r, 0))

/** @typedef {{ id: string, requires?: string[], run: (api: any) => any }} Case */

const fakeSignal = api => {
  const subscribers = []
  const fake = () => 1
  fake[api.subscribeSymbol] = u => {
    subscribers.push(u)
    return () => subscribers.splice(subscribers.indexOf(u), 1)
  }
  fake[api.triggerSymbol] = () => subscribers.forEach(f => f())
  fake.fire = () => subscribers.forEach(f => f())
  return fake
}

/** @type {Case[]} */
export const cases = [
  // ------------------------------------------------------------------ core: the K1–K10 contract
  {
    id: 'core.callable',
    run(api) {
      const $s = api.signal(1)
      ok($s instanceof Function, 'a signal is a plain function')
      eq($s(), 1, 'no-arg call reads')
      $s(2)
      eq($s(), 2, 'one-arg call writes')
      eq($s.get(), 2, '.get() reads')
      eq($s[Symbol.toPrimitive](), 2, 'Symbol.toPrimitive reads')
    },
  },
  {
    id: 'core.changed-result',
    run(api) {
      const $s = api.signal(1)
      eq($s(2), true, 'a changed write returns true')
      eq($s(2), undefined, 'an unchanged write returns undefined')
    },
  },
  {
    id: 'core.equality',
    run(api) {
      const $s = api.signal(1)
      let fires = 0
      api.observe($s, () => fires++)
      $s(0)
      const afterFirst = fires
      $s(-0)
      eq(fires, afterFirst, '-0 over 0 is not a change')
      const $n = api.signal(NaN)
      let nfires = 0
      api.observe($n, () => nfires++)
      $n(NaN)
      eq(nfires, 1, 'NaN over NaN is always a change')
      const obj = { a: 1 }
      const $o = api.signal(obj)
      let ofires = 0
      api.observe($o, () => ofires++)
      $o(obj)
      eq(ofires, 0, 'same identity is not a change')
      $o({ a: 1 })
      eq(ofires, 1, 'a new equal object is a change')
    },
  },
  {
    id: 'core.observeNow',
    run(api) {
      const $s = api.signal('bla')
      let value
      const un = api.observeNow($s, v => (value = v))
      eq(value, 'bla', 'observeNow calls back immediately with the value')
      api.observeNow('boink', v => (value = v))
      eq(value, 'boink', 'observeNow passes a static value too')
      $s('next')
      eq(value, 'next', 'and on every change')
      un()
    },
  },
  {
    id: 'core.subscribe-zero-args',
    run(api) {
      const $s = api.signal(1)
      let calls = 0
      let arg = 'sentinel'
      const un = api.subscribe($s, (...args) => {
        calls++
        arg = args.length
      })
      eq(calls, 0, 'subscribe does not call immediately')
      $s(2)
      eq(calls, 1, 'subscribe calls on change')
      eq(arg, 0, 'subscribe passes zero arguments')
      un()
    },
  },
  {
    id: 'core.unsubscribe',
    run(api) {
      const $s = api.signal(1)
      let count = 0
      const un = api.observe($s, () => count++)
      $s(2)
      eq(count, 1)
      un()
      $s(3)
      eq(count, 1, 'unsubscribe stops delivery')
      eq(
        api.observe(1, () => {}),
        undefined,
        'observing a static value returns undefined',
      )
    },
  },
  {
    id: 'core.derived-eager',
    run(api) {
      const $a = api.signal(1)
      const $b = api.signal(2)
      const $sum = api.$S(() => $a() + $b(), $a, $b)
      eq($sum(), 3)
      $a(2)
      eq($sum(), 4, 'a derived value recomputes synchronously after a dependency write')
      let fired = 0
      api.observe($sum, () => fired++)
      $b(3)
      eq(fired, 1, 'a derived signal notifies its listeners')
      eq($sum(), 5)
    },
  },
  {
    id: 'core.$S-value-form',
    run(api) {
      const $v = api.$S(7)
      eq($v(), 7, '$S(value) is a plain signal')
      $v(8)
      eq($v(), 8)
      // The documented ambiguity: with a single argument there is no way to tell "initial value" from
      // "derived getter", so a function argument is a *value*. Every direction must keep this, which
      // is why auto-tracking cannot be bolted onto the one-argument form.
      const fn = () => 1
      const $f = api.$S(fn)
      eq($f(), fn, '$S(fn) holds the function itself — it is NOT a derived signal')
    },
  },
  {
    id: 'core.$F-values',
    run(api) {
      const $a = api.signal(0)
      const $b = api.signal(1)
      const val = (a, b) => a + b
      eq(api.$F(val, $a, $b)(), 1, '$F passes signal values to the filter')
      eq(api.$Or($a, $b)(), 1, '$Or returns the value, not a boolean')
      eq(api.$If($a, 'a', 'b')(), 'b')
      eq(api.$If($b, 'a', 'b')(), 'a')
      eq(api.$F(val, 1, 2)(), 3, '$F over static values')
    },
  },
  {
    id: 'core.template-form',
    run(api) {
      const $n = api.signal('x')
      const $t = api.$S`Count:${$n}`
      eq($t(), 'Count:x')
      $n('y')
      eq($t(), 'Count:y', 'the tagged-template form still tracks')
    },
  },
  {
    id: 'core.state-reset',
    run(api) {
      const $s = api.$State({ x: 1 })
      eq($s({ y: 1 }), true, 'replacing state reports the change')
      deepEq($s(), { y: 1, x: undefined }, 'absent keys reset to undefined')
      eq($s({ y: 1 }), false, 'a repeat replace reports no change')
    },
  },
  {
    id: 'core.state-snapshot',
    run(api) {
      const $s = api.$State({ x: 1, y: 2 })
      deepEq($s.toJSON(), { x: 1, y: 2 })
      deepEq($s[Symbol.toPrimitive](), { x: 1, y: 2 })
      $s.x++
      eq($s.x(), 2, '$s.x++ read-modify-writes through the proxy')
      deepEq($s(), { x: 2, y: 2 })
    },
  },
  {
    id: 'core.state-lazy-keys',
    run(api) {
      const $s = api.$State()
      deepEq($s(), {})
      $s.late = 3
      eq($s.late(), 3, 'assigning an undeclared key creates its signal')
      deepEq($s(), { late: 3 })
    },
  },
  {
    id: 'core.state-merge',
    run(api) {
      const $s = api.$State({ x: 1 })
      eq(api.mergeValue($s, { y: 1 }), true)
      deepEq($s(), { y: 1, x: 1 }, 'mergeValue does not reset absent keys')
      eq(api.mergeValue($s, { y: 1 }), false, 'an equal merge reports no change')
    },
  },
  {
    id: 'core.state-aggregate-batching',
    run(api) {
      const $s = api.$State({ x: 1, y: 1 })
      let aggregate = 0
      let child = 0
      api.observe($s, () => aggregate++)
      api.observe($s.x, () => child++)
      api.mergeValue($s, { x: 2, y: 2 })
      eq(aggregate, 1, 'one aggregate event per multi-key merge')
      eq(child, 1, 'the changed child fires once')
      eq($s.x(), 2)
    },
  },
  {
    id: 'core.state-derived-batching',
    run(api) {
      const $s = api.$State({ firstName: 'John', lastName: 'Doe' })
      const $full = api.$S(() => `${$s.firstName()} ${$s.lastName()}`, $s)
      let fired = 0
      api.observe($full, () => fired++)
      api.mergeValue($s, { firstName: 'Jane', lastName: 'Smith' })
      eq($full(), 'Jane Smith')
      eq(fired, 1, 'a derived of two batch-changed keys notifies once')
    },
  },
  {
    id: 'core.debug-labels',
    run(api) {
      const $s = api.signal(1, 'mySignal')
      eq($s.label, 'mySignal')
      eq($s.name, 'mySignal')
      const $d = api.signal(1)
      eq($d.label, undefined)
      eq($d.name, '$signal', 'the default function name is preserved')
    },
  },
  {
    id: 'core.prepareSignal-shape',
    run(api) {
      const internals = api.prepareSignal(1, 'p')
      ok(internals.$signal instanceof Function, '$signal')
      ok(internals.listeners instanceof Set, 'listeners is a Set')
      eq(typeof internals.setValue, 'function', 'setValue')
      eq(typeof internals.fireChanged, 'function', 'fireChanged')
      eq(internals.setValue(2), true)
      eq(internals.setValue(2), undefined)
    },
  },
  {
    id: 'core.fake-signal-duck-typing',
    run(api) {
      // This is exactly the shape libs/jsx6/src/trans.js builds by hand.
      const fake = fakeSignal(api)
      ok(api.isObservable(fake), 'isObservable accepts a duck-typed signal')
      const $derived = api.$F(v => v + 1, fake)
      eq($derived(), 2)
      let seen = []
      api.observe(fake, v => seen.push(v))
      fake.fire()
      eq(seen.length, 1, 'a duck-typed trigger reaches its observer')
      // `triggerSignal` is defined in src/observe.js but is NOT re-exported from the package entry,
      // so it is optional here (a direction may add it; the baseline cannot offer it).
      if (typeof api.triggerSignal === 'function') {
        eq(api.triggerSignal(fake), true, 'triggerSignal reports that it triggered')
      }
    },
  },
  {
    id: 'core.asSignal-promise',
    async run(api) {
      let resolve
      const p = new Promise(r => (resolve = r))
      const $s = api.asSignal(p)
      let count = 0
      api.observe($s, () => count++)
      resolve(10)
      await p
      await wait()
      eq($s(), 10, 'asSignal mirrors a promise')
      eq(count, 1, 'and notifies once')
    },
  },
  {
    id: 'core.makeSignalContext',
    async run(api) {
      const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
      GlobalRegistrator.register()
      try {
        const ctxs = api.makeSignalContext()
        const el = document.createElement('div')
        ctxs.set(el, 1)
        eq(ctxs.get(el), 1)
        let value
        api.$F(v => (value = v), ctxs.getSignal(el))
        eq(value, 1, 'a context signal feeds a derived signal')
        ctxs.set(el, 3)
        eq(ctxs.get(el), 3)
        eq(value, 3, 'and updates it eagerly')
      } finally {
        GlobalRegistrator.unregister()
      }
    },
  },
  {
    id: 'core.declared-deps-invalidate',
    run(api) {
      const $s = api.$State({ x: 1, y: 1 })
      // The declared dependency is the whole state, but the callback only reads `x`. The contract is
      // that a change to `y` still triggers a *recomputation* (the value itself does not change, so
      // listeners must not fire — that distinction is the point of this case).
      let runs = 0
      const $x = api.$S(() => {
        runs++
        return $s.x()
      }, $s)
      const before = runs
      let fired = 0
      api.observe($x, () => fired++)
      $s.y = 2
      eq(runs > before, true, 'a declared-but-unread dependency still causes a recomputation')
      eq(fired, 0, 'but an unchanged value does not notify listeners')
      eq($x(), 1)
      $s.x = 5
      eq($x(), 5)
      eq(fired, 1, 'a real change does notify')
    },
  },
  {
    id: 'union-deps.omitted-dep',
    requires: ['union-deps'],
    run(api) {
      const $a = api.signal(1)
      const $b = api.signal(2)
      const $sum = api.$S(() => $a() + $b(), $a) // $b omitted on purpose
      eq($sum(), 3)
      $b(20)
      eq($sum(), 21, 'an omitted-but-read dependency is caught by auto-tracking')
      $a(2)
      eq($sum(), 22)
    },
  },

  // ------------------------------------------------------------------ computed axis
  {
    id: 'computed.auto-track',
    requires: ['computed:auto'],
    run(api) {
      const $a = api.signal(1)
      const $b = api.signal(2)
      const $sum = api.$C(() => $a() + $b()) // no dependency list at all
      eq($sum(), 3, 'a computed derives without declared dependencies')
      $a(10)
      eq($sum(), 12, 'a write to either auto-tracked dependency is picked up')
      $b(20)
      eq($sum(), 30)
    },
  },
  {
    id: 'computed.lazy-memo',
    requires: ['computed'],
    run(api) {
      const $a = api.signal(1)
      let runs = 0
      // Explicit dependency: every `$C` provider must support this form. Auto-tracking providers
      // additionally support the no-dependency form (see `computed.auto-track`).
      const $c = api.$C(() => {
        runs++
        return $a() * 2
      }, $a)
      eq(runs, 0, 'a lazy computed does not evaluate before it is read')
      eq($c(), 2)
      eq(runs, 1, 'first read evaluates once')
      eq($c(), 2)
      eq(runs, 1, 'repeated reads are memoized')
      $a(2)
      eq(runs, 1, 'a write does not recompute a lazy computed that nobody observed')
      eq($c(), 4)
      eq(runs, 2, 'the next read recomputes once')
    },
  },
  {
    id: 'computed.read-only',
    requires: ['computed'],
    run(api) {
      const $a = api.signal(1)
      const $c = api.$C(() => $a() + 1, $a)
      let threw = false
      try {
        $c(99)
      } catch {
        threw = true
      }
      eq($c(), 2, 'writing a computed does not change its value')
      void threw // silently no-op (alien) or throw (a stricter design) are both recorded
    },
  },
  {
    id: 'computed.eager',
    requires: ['computed:eager'],
    run(api) {
      const $a = api.signal(1)
      let runs = 0
      const $c = api.$CE(() => {
        runs++
        return $a() + 1
      }, $a)
      eq(runs, 1, 'an eager computed evaluates at creation')
      $a(2)
      eq(runs, 2, 'and recomputes on a dependency write without being read')
      eq($c(), 3)
    },
  },
  {
    id: 'computed.notifies-observers',
    requires: ['computed'],
    run(api) {
      const $a = api.signal(1)
      const $c = api.$C(() => $a() * 3, $a)
      let fired = 0
      api.observe($c, () => fired++)
      const un = api.observeNow($c, () => fired++)
      $a(2)
      eq(fired, 3, 'observeNow fired immediately, then both observers were notified')
      un()
      $a(3)
      eq(fired, 4, 'and the unsubscribed observer no longer fires')
    },
  },
  {
    id: 'computed.alien-auto-track',
    requires: ['computed:alien-only'],
    run(api) {
      // The "just use alien's computed" shape: reads are tracked because the inputs are alien nodes.
      const A = api.toAlien(api.signal(1))
      const B = api.toAlien(api.signal(2))
      const $sum = api.$C(() => A() + B())
      eq($sum(), 3)
      A(10)
      eq($sum(), 12, 'alien-valued inputs are auto-tracked')
    },
  },
  {
    id: 'computed.dynamic-deps',
    requires: ['computed:dynamic-deps'],
    run(api) {
      // A dependency that only appears on a later evaluation. Only an implementation that re-derives
      // its dependency list on every recomputation can follow this.
      const $flag = api.signal(true)
      const $a = api.signal(1)
      const $b = api.signal(10)
      const $pick = api.$C(() => ($flag() ? $a() : $b()))
      eq($pick(), 1)
      $flag(false)
      eq($pick(), 10, 'the branch switch is picked up')
      $b(20)
      eq($pick(), 20, 'and the dependency that appeared later is tracked')
    },
  },
  {
    id: 'computed.state-child',
    requires: ['computed:auto'],
    run(api) {
      const $s = api.$State({ x: 2 })
      const $c = api.$C(() => $s.x() * 5)
      eq($c(), 10, 'a computed tracks a $State child signal')
      $s.x = 3
      eq($c(), 15)
      const $whole = api.$C(() => $s().x + 1)
      eq($whole(), 4, 'and the whole-state snapshot form')
      $s.x = 9
      eq($whole(), 10)
    },
  },

  // ------------------------------------------------------------------ batch axis
  {
    id: 'batch.single-notify',
    requires: ['batch:core'],
    run(api) {
      const $s = api.$State({ x: 1, y: 1 })
      const $sum = api.$S(() => $s.x() + $s.y(), $s)
      const seen = []
      api.observe($sum, () => seen.push($sum()))
      api.batch(() => {
        $s.x = 2
        $s.y = 3
      })
      eq(seen.length, 1, 'two writes in a batch produce one notification')
      deepEq(seen, [5], 'and no intermediate value is ever observed')
      eq($sum(), 5)
    },
  },
  {
    id: 'batch.alien-path',
    requires: ['batch', 'interop'],
    run(api) {
      // `batch` must at least coalesce the alien-level effect queue: bridging two jsx6 writes and
      // observing an alien computed should yield one coalesced update, not two.
      const $a = api.signal(1)
      const $b = api.signal(1)
      const A = api.toAlien($a)
      const B = api.toAlien($b)
      const sum = api.alien.computed(() => A() + B())
      const seen = []
      api.observeNow(sum, v => seen.push(v))
      api.batch(() => {
        $a(2)
        $b(3)
      })
      deepEq(seen, [2, 5], 'immediate value plus one coalesced update, no intermediate value')
    },
  },
  {
    id: 'batch.exception-safe',
    requires: ['batch:core'],
    run(api) {
      const $s = api.$State({ x: 1 })
      const $d = api.$S(() => $s.x() * 2, $s)
      // Whether a throwing batch rethrows is a design choice; that the graph survives is not.
      try {
        api.batch(() => {
          $s.x = 2
          throw new Error('boom')
        })
      } catch {}
      eq($d(), 4, 'a throwing batch still leaves the graph usable')
      $s.x = 3
      eq($d(), 6, 'and later writes still propagate')
    },
  },

  {
    id: 'computed.dispose',
    requires: ['computed', 'dispose'],
    run(api) {
      const $a = api.signal(1)
      let runs = 0
      const $c = api.$C(() => {
        runs++
        return $a() + 1
      }, $a)
      eq($c(), 2)
      const before = runs
      api.dispose($c)
      $a(2)
      eq(runs, before, 'after dispose a write no longer reaches the getter')
    },
  },
  {
    id: 'alien-surface.effect-and-scope',
    requires: ['alien-surface'],
    run(api) {
      const A = api.toAlien(api.signal(1))
      const seen = []
      const stop = api.$watch(() => {
        seen.push(A())
        return undefined
      })
      deepEq(seen, [1], '$watch runs immediately')
      const stopScope = api.$scope(() => {
        api.$watch(() => {
          seen.push(A() * 10)
          return undefined
        })
      })
      eq(seen.length, 2, 'a scoped watch runs immediately too')
      stop()
      stopScope()
      A(2)
      deepEq(seen, [1, 10], 'both watchers are stopped')
    },
  },

  // ------------------------------------------------------------------ interop axis
  {
    id: 'interop.toAlien',
    requires: ['interop'],
    run(api) {
      const $a = api.signal(1)
      const $b = api.signal(2)
      const A = api.toAlien($a)
      const B = api.toAlien($b)
      const sum = api.alien.computed(() => A() + B())
      eq(sum(), 3, 'an alien computed reads bridged jsx6 signals')
      $a(10)
      eq(sum(), 12, 'a jsx6 write updates the alien computed')
      ok(api.isAlienComputed(sum), 'isAlienComputed recognises it')
      ok(api.isAlienSignal(A), 'isAlienSignal recognises a bridge')
    },
  },
  {
    id: 'interop.unbridged-does-not-track',
    requires: ['interop', 'interop:bridge-required'],
    run(api) {
      const $a = api.signal(1)
      let runs = 0
      const c = api.alien.computed(() => {
        runs++
        return $a() // NOTE: not bridged
      })
      eq(c(), 1)
      const before = runs
      $a(2)
      eq(c(), 1, 'documented limitation: an unbridged jsx6 signal is invisible to alien tracking')
      eq(runs, before, 'and the getter does not even re-run')
    },
  },
  {
    id: 'interop.unbridged-tracks-natively',
    requires: ['interop:no-bridge-needed'],
    run(api) {
      // The inverse capability: a core whose signals ARE alien nodes needs no bridge at all.
      const $a = api.signal(1)
      let runs = 0
      const c = api.alien.computed(() => {
        runs++
        return $a() * 10
      })
      eq(c(), 10)
      $a(2)
      eq(c(), 20, 'a bare jsx6 signal read inside an alien computed is tracked natively')
      eq(runs, 2, 'and the getter re-ran exactly once')
    },
  },
  {
    id: 'interop.toSignal',
    requires: ['interop'],
    run(api) {
      const a = api.alien.signal(1)
      const $mirror = api.toSignal(a)
      eq($mirror(), 1, 'an alien signal is mirrored into a callable jsx6 signal')
      let seen = []
      const un = api.observe($mirror, () => seen.push($mirror()))
      a(2)
      deepEq(seen, [2], 'an alien write notifies jsx6 observers')
      un()
      a(3)
      deepEq(seen, [2], 'and the stop function works')
    },
  },
  {
    id: 'interop.observe-alien-directly',
    requires: ['interop'],
    run(api) {
      const a = api.alien.signal(1)
      const c = api.alien.computed(() => a() * 2)
      let value
      const un = api.observeNow(c, v => (value = v))
      eq(value, 2, 'observeNow understands an alien computed (this is what makes {$computed} work)')
      a(3)
      eq(value, 6)
      un()
      a(4)
      eq(value, 6, 'and its unsubscribe works')
    },
  },
  {
    id: 'interop.effect-reads-jsx6',
    requires: ['interop'],
    run(api) {
      const $a = api.signal(1)
      const A = api.toAlien($a)
      const seen = []
      const stop = api.alien.effect(() => {
        seen.push(A())
        return undefined
      })
      deepEq(seen, [1], 'an alien effect reads a bridged jsx6 signal')
      $a(2)
      deepEq(seen, [1, 2])
      stop()
      $a(3)
      deepEq(seen, [1, 2], 'stopping the effect detaches it')
    },
  },
  {
    id: 'interop.footgun-safe',
    requires: ['interop'],
    run(api) {
      // The compat layer must never hand a user callback's return value to alien's `effect`, which
      // treats a truthy non-function return as a cleanup function and throws on the next run.
      const $a = api.signal(1)
      let counter = 0
      notThrows(() => {
        api.observeNow($a, () => counter++) // returns a number
        $a(2)
        $a(3)
      }, 'a value-returning callback must not crash the compat layer')
      eq(counter >= 2, true, 'the callback ran')
      const b = api.alien.signal(1)
      notThrows(() => {
        api.observeNow(b, () => counter++)
        b(2)
        b(3)
      }, 'same for a bare alien signal')
    },
  },
  {
    id: 'interop.alien-dep-in-derived',
    requires: ['interop'],
    run(api) {
      // A derived signal that consumes an alien value: the compat layer must normalise the alien node
      // into something the core's dependency machinery understands.
      const a = api.alien.signal(1)
      const $doubled = api.$F(v => v * 2, a)
      eq($doubled(), 2, 'an alien signal can be a $F dependency')
      a(3)
      eq($doubled(), 6, 'and it invalidates the derived signal')
      const $mapped = api.$S(() => a() + 1, a)
      eq($mapped(), 4, 'an alien signal can be a $S dependency')
      a(5)
      eq($mapped(), 6)
    },
  },
  {
    id: 'interop.state-child-inside-alien',
    requires: ['interop'],
    run(api) {
      const $s = api.$State({ x: 1, y: 2 })
      const X = api.toAlien($s.x)
      const Y = api.toAlien($s.y)
      const total = api.alien.computed(() => X() + Y())
      eq(total(), 3)
      $s.x = 10
      eq(total(), 12, 'a $State child signal drives an alien computed through a bridge')
    },
  },
]

export const caseById = id => cases.find(c => c.id === id)

export { AssertionError }
