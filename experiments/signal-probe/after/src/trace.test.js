/**
 * Tracing: the internals that a debugger wrapper needs, and the wrapper itself.
 *
 * The contract this pins down:
 *   - nothing is attached and nothing is captured while tracing is off;
 *   - turning it on attaches a creation site and the live listener set to *named* signals;
 *   - a computed additionally exposes its getter (the clickable source reference) and its dependencies;
 *   - `traceSignal` is a drop-in signal: the graph flows through it, and only real writes activate it;
 *   - the wrapper reports and never breaks the signal it watches.
 */
import { expect, test } from 'bun:test'
import {
  $C,
  $State,
  mergeValue,
  metaSymbol,
  onStateWrite,
  signal,
  signalTrace,
  traceSignal,
  traceSignals,
} from '../index.js'

/** Tracing is process-global state; every test states its own assumption and restores it. */
const withTracing = (on, fn) => {
  const prev = traceSignals(on)
  try {
    return fn()
  } finally {
    traceSignals(prev)
  }
}

/** A sink that records what the wrapper logged, so no test output depends on the console. */
const sink = () => {
  const lines = []
  return {
    lines,
    log: (...args) => lines.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')),
  }
}

test('nothing is attached, and nothing is captured, while tracing is off', () => {
  traceSignals(false)
  const $a = signal(1, 'a')
  const $c = $C(() => $a() + 1, 'c')
  $c()

  expect(signalTrace($a)).toBeUndefined()
  expect(signalTrace($c)).toBeUndefined()
  expect(Object.getOwnPropertySymbols($a)).not.toContain(metaSymbol)
  // and the signal still behaves exactly like a signal
  expect($a(2)).toBe(true)
  expect($c()).toBe(3)
})

test('tracing on: a named signal carries its creation site and its live listener set', () => {
  withTracing(true, () => {
    const $a = signal(1, 'a')
    const meta = signalTrace($a)

    expect(meta.kind).toBe('signal')
    expect(meta.origin.text).toContain('trace.test.js')
    expect(meta.origin.line).toBeGreaterThan(0)
    expect(meta.listeners).toBeInstanceOf(Set)
    expect(meta.listeners.size).toBe(0)

    // the listener set is live, not a snapshot: this is "what depends on this signal"
    const unsubscribe = $a[Symbol.for('signalSubscribe')](() => {})
    expect(meta.listeners.size).toBe(1)
    unsubscribe()
    expect(meta.listeners.size).toBe(0)
  })
})

test('tracing on: a computed exposes its getter and its dependencies', () => {
  withTracing(true, () => {
    const $a = signal(1, 'a')
    const $b = signal(2, 'b')
    const getter = () => $a() + $b()
    // NOTE: `$C`/`$CE` take *declared dependencies* after the getter, not a name — a label comes from
    // `createComputed`'s `name` option, which is internal. So this computed is anonymous.
    const $sum = $C(getter)
    $sum() // a lazy computed has no dependencies until it has evaluated

    const meta = signalTrace($sum)
    expect(meta.kind).toBe('computed')
    // the *user's* function, not the library's wrapper: this is the reference DevTools can resolve
    expect(meta.getter).toBe(getter)
    const deps = meta.deps()
    expect(deps.tracked).toEqual([$a, $b])
    expect(deps.declared).toEqual([])
  })
})

test('tracing on: an anonymous signal is skipped, so internal helper signals stay clean', () => {
  withTracing(true, () => {
    expect(signalTrace(signal(1))).toBeUndefined()
    expect(signalTrace(signal(1, 'named'))).not.toBeUndefined()
  })
})

test('traceSignals returns the previous state and accepts options', () => {
  traceSignals(false)
  expect(traceSignals(true)).toBe(false)
  expect(traceSignals(false)).toBe(true)

  // options-only form turns tracing on
  expect(traceSignals({ origin: false })).toBe(false)
  const $x = signal(1, 'x')
  const meta = signalTrace($x)
  expect(meta).not.toBeUndefined()
  expect(meta.origin).toBeNull() // origin capture was switched off
  expect(meta.listeners).toBeInstanceOf(Set) // listeners were not
  traceSignals(false)
})

test('a traced signal is still a normal signal in every observable way', () => {
  withTracing(true, () => {
    const $a = signal(0, 'a')
    const seen = []
    const unsubscribe = $a[Symbol.for('signalSubscribe')](() => seen.push($a()))

    expect($a(1)).toBe(true)
    expect($a(1)).toBeUndefined() // the === guard is untouched
    expect($a()).toBe(1)
    expect(String($a)).toBe('1')
    expect($a.value).toBe(1)
    expect(seen).toEqual([1])

    unsubscribe()
    $a(2)
    expect(seen).toEqual([1])
    expect(Object.keys($a)).not.toContain(metaSymbol) // symbols are not enumerable anyway
  })
})

test('traceSignal reports reads, and only writes that actually changed the value', () => {
  const out = sink()
  const $a = signal(0, 'a')
  const $t = traceSignal($a, { label: 'a', log: out.log, max: 10 })

  expect($t()).toBe(0) // read
  $t(1) // write: changed
  $t(1) // write: unchanged, so not an activation
  expect($t.activations()).toBe(2)
  expect(out.lines.some(l => l.includes('read signal a = 0'))).toBe(true)
  expect(out.lines.some(l => l.includes('write signal a = 1'))).toBe(true)
  expect(out.lines.filter(l => l.includes('write')).length).toBe(1)
})

test('traceSignal is a drop-in signal: the dependency graph flows through it', () => {
  const out = sink()
  const $a = signal(1, 'a')
  const $w = traceSignal($a, { label: 'a', log: out.log, max: 1 })
  const $derived = $C(() => $w() * 2, 'derived')

  expect($derived()).toBe(2)
  $a(3)
  expect($derived()).toBe(6)
  // the wrapper delegated subscribe, so the computed really did depend on it
  expect(signalTrace($a).listeners.size).toBeGreaterThan(0)
})

test('traceSignal stops logging after `max`, but onActivate keeps seeing activations', () => {
  const out = sink()
  const seen = []
  const $a = signal(0, 'a')
  const $t = traceSignal($a, {
    label: 'a',
    log: out.log,
    max: 2,
    onActivate: info => seen.push(info.activation),
  })

  $t(1)
  $t(2)
  $t(3)
  $t(4)

  expect(seen).toEqual(['write', 'write', 'write', 'write'])
  expect(out.lines.filter(l => l.includes('write signal')).length).toBe(2)
  expect(out.lines.some(l => l.includes('going quiet'))).toBe(true)
})

test('traceSignal snapshot is a plain object with the clickable references', () => {
  const out = sink()
  const $a = signal(1, 'a')
  const getter = () => $a() * 2
  const $c = $C(getter, 'double')
  const $t = traceSignal($c, { label: 'double', log: out.log, max: 1 })

  $t()
  const snap = $t.snapshot()

  expect(snap.signal).toBe('double')
  expect(snap.kind).toBe('computed')
  expect(snap.value).toBe(2)
  expect(snap.deps).toEqual(['a'])
  expect(snap.getter).toBe(getter) // the reference DevTools resolves to source
  expect(typeof snap.raw).toBe('function')
  // show() logs exactly that object, which is what makes the reference expandable
  $t.show()
  expect(out.lines.some(l => l.includes('"signal":"double"'))).toBe(true)
})

test('traceSignal never breaks the signal it watches, even when the getter throws', () => {
  const out = sink()
  const $gate = signal(true, 'gate')
  const $fragile = $C(() => {
    if (!$gate()) throw new Error('boom')
    return 7
  })
  const $t = traceSignal($fragile, { label: 'fragile', log: out.log, max: 5 })

  expect($t()).toBe(7)
  $gate(false)
  // The library's own semantics are that a *read* reports the failure (computed-errors.test.js), so
  // the wrapper must not swallow it: it reports what happened and lets the read fail as it normally
  // would. What it must never do is throw something of its own.
  let thrown
  try {
    $t()
  } catch (e) {
    thrown = e
  }
  expect(thrown?.message).toBe('boom')
  const snap = $t.snapshot() // reporting a broken signal still works
  expect(snap.value).toContain('boom')
})

test('traceSignal on a $State child reports the wrapper it can see', () => {
  const out = sink()
  const $s = $State({ n: 1 })
  const $child = traceSignal($s.n, { label: '$s.n', log: out.log, max: 5 })

  expect($child()).toBe(1)
  // the state proxy's set trap writes the *raw* child signal, so a write through the proxy is
  // invisible to a wrapper; writing through the wrapper is what it can observe. Documented limit.
  $s.n = 2
  expect($s.n()).toBe(2)
  expect($child()).toBe(2) // read through the wrapper sees the new value
  $child(3)
  expect(out.lines.some(l => l.includes('write signal $s.n = 3'))).toBe(true)
})

test('traceSignal auto-enables tracing, and an explicit off is respected afterwards', () => {
  traceSignals(false)
  const $a = signal(1, 'a')
  const $t = traceSignal($a, { label: 'a', max: 1 })
  expect(signalTrace($a)).not.toBeUndefined() // asking for a traced signal asks for tracing

  $t()
  traceSignals(false)
  const $b = signal(1, 'b')
  expect(signalTrace($b)).toBeUndefined() // the deliberate off was not undone
})

// ------------------------------------------------------------------------------------------------
// `$State`: the case a wrapper cannot see by itself, because the proxy's `set` trap writes the raw
// child signal, and the setter paths write it inside the state's own `updateValue`.
// See `src/state-write-observer.js`.

const stateSink = () => {
  const lines = []
  return {
    lines,
    log: (...a) => lines.push(a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')),
  }
}
const writes = lines => lines.filter(l => l.includes('write'))

test('traceSignal on a $State reports a write made through the proxy, per field', () => {
  const out = stateSink()
  const $s = $State({ count: 0, name: 'ada' })
  const $t = traceSignal($s, { label: 'cart', log: out.log, max: 20 })

  $t.count = 1 // the assignment a wrapper around `$s.count` would have missed
  expect(writes(out.lines).length).toBe(1)
  expect(out.lines.some(l => l.includes('cart.count = 1'))).toBe(true)

  $t.count = 1 // unchanged: the === guard, so no report
  expect(writes(out.lines).length).toBe(1)

  $t.name = 'grace'
  expect(writes(out.lines).length).toBe(2)
  expect($s.name()).toBe('grace')
})

test('traceSignal on a $State reads the whole state, and its children are its dependencies', () => {
  const out = stateSink()
  const $s = $State({ count: 1, name: 'ada' })
  const $t = traceSignal($s, { label: 'cart', log: out.log, max: 5 })

  expect($t()).toEqual({ count: 1, name: 'ada' })
  expect(out.lines.some(l => l.includes('read $State cart'))).toBe(true)
  expect($t.snapshot().deps).toEqual(['count', 'name'])
})

test('traceSignal on a $State reports mergeValue per changed field', () => {
  const out = stateSink()
  const $t = traceSignal($State({ count: 0, name: 'ada' }), { label: 'cart', log: out.log, max: 20 })

  mergeValue($t, { count: 5, name: 'alan' })
  expect(writes(out.lines).length).toBe(2)
  expect(out.lines.some(l => l.includes('cart.count = 5'))).toBe(true)
  expect(out.lines.some(l => l.includes('cart.name = "alan"'))).toBe(true)

  out.lines.length = 0
  mergeValue($t, { count: 5, name: 'alan' }) // nothing changed
  expect(writes(out.lines).length).toBe(0)
})

test('traceSignal on a $State reports the callable setter, including the reset to undefined', () => {
  const out = stateSink()
  const $t = traceSignal($State({ count: 0, name: 'ada' }), { label: 'cart', log: out.log, max: 20 })

  $t({ count: 9 }) // `name` is absent, so setValue resets it to undefined — also a write
  expect(writes(out.lines).length).toBe(2)
  expect(out.lines.some(l => l.includes('cart.count = 9'))).toBe(true)
  expect(out.lines.some(l => l.includes('cart.name = undefined'))).toBe(true)
  expect($t()).toEqual({ count: 9 })
})

test('a state wrapper does not disturb the graph: derived values still invalidate', () => {
  const out = stateSink()
  const $t = traceSignal($State({ a: 1, b: 2 }), { label: 'st', log: out.log, max: 20 })
  const $sum = $C(() => $t.a() + $t.b())

  expect($sum()).toBe(3)
  $t.a = 10
  expect($sum()).toBe(12)
  mergeValue($t, { b: 20 })
  expect($sum()).toBe(30)
})

test('a state wrapper reports nothing for another state with the same field names', () => {
  const out = stateSink()
  const $a = traceSignal($State({ count: 0 }), { label: 'A', log: out.log, max: 10 })
  const $b = traceSignal($State({ count: 0 }), { label: 'B', log: out.log, max: 10 })

  $b.count = 7
  expect(out.lines.filter(l => l.includes('B.count'))).toHaveLength(1)
  expect(out.lines.filter(l => l.includes('A.count'))).toHaveLength(0)
  void $a
})

test('disposing a state wrapper stops its reports, and the state keeps working', () => {
  const out = stateSink()
  const $s = $State({ count: 0 })
  const $t = traceSignal($s, { label: 'cart', log: out.log, max: 10 })

  $t.count = 1
  expect(writes(out.lines).length).toBe(1)

  $t.dispose()
  out.lines.length = 0
  $t.count = 2
  expect(writes(out.lines).length).toBe(0) // the observer is gone, so nothing accumulates
  expect($s.count()).toBe(2) // the state itself is untouched
})

test('onStateWrite is the primitive under the state wrapper, and is inert without it', () => {
  const seen = []
  const stop = onStateWrite((child, value) => seen.push([child.label, value]))
  const $s = $State({ a: 1 })

  $s.a = 2
  expect(seen).toEqual([['a', 2]])

  stop()
  $s.a = 3
  // Unregistered: *this* observer is gone. The assertion is about this callback rather than about the
  // global set being empty, because a wrapper created by another test may still be registered — and an
  // observer does not take its state with it when it stops.
  expect(seen).toEqual([['a', 2]])
})

test('a $State proxy is never probed for tracing metadata (that would create a field)', () => {
  withTracing(true, () => {
    const $s = $State({ a: 1 })
    const $t = traceSignal($s, { label: 's', max: 1 })
    // `__computed` is the marker the tracing helpers test for; reading it through a state proxy would
    // *create* that child signal, silently adding a field to the application's state.
    expect($s()).toEqual({ a: 1 })
    expect(Object.keys($s())).toEqual(['a'])
    $t.dispose()
  })
})
