import { expect, test } from 'bun:test'
import {
  $C,
  $CE,
  batch,
  dispose,
  $S,
  $F,
  $State,
  mergeValue,
  signal,
  observe,
  observeNow,
  subscribe,
  subscribeSymbol,
} from '../index.js'
import { collectStart } from './track.js'

/**
 * Runs `fn` with `console.error` captured, and returns the messages it logged. Used for the cycle
 * reports, which are errors by design but must not abort the caller.
 * @param {() => void} fn
 * @returns {Array<string>}
 */
const captureConsoleError = fn => {
  const original = console.error
  const messages = []
  console.error = (...args) => messages.push(args.map(String).join(' '))
  try {
    fn()
  } finally {
    console.error = original
  }
  return messages
}

test('$C is lazy and memoized', () => {
  const $a = signal(1)
  let runs = 0
  const $c = $C(() => {
    runs++
    return $a() * 2
  })

  expect(runs).toBe(0) // not evaluated before the first read
  expect($c()).toBe(2)
  expect(runs).toBe(1)
  expect($c()).toBe(2)
  expect(runs).toBe(1) // memoized

  $a(2)
  expect(runs).toBe(1) // a cold computed is not recomputed by a write
  expect($c()).toBe(4)
  expect(runs).toBe(2)
})

test('$C auto-tracks reads without a dependency list', () => {
  const $a = signal(1)
  const $b = signal(2)
  const $sum = $C(() => $a() + $b())

  expect($sum()).toBe(3)
  $a(10)
  expect($sum()).toBe(12)
  $b(20)
  expect($sum()).toBe(30)
})

test('$C follows a dependency that appears on a later evaluation', () => {
  const $flag = signal(true)
  const $a = signal(1)
  const $b = signal(10)
  const $pick = $C(() => ($flag() ? $a() : $b()))

  expect($pick()).toBe(1)
  $flag(false)
  expect($pick()).toBe(10)
  $b(20) // read for the first time only on the previous evaluation
  expect($pick()).toBe(20)
})

test('$C tracks $State children and whole-state reads', () => {
  const $s = $State({ x: 2, y: 5 })
  const $child = $C(() => $s.x() * 5)
  expect($child()).toBe(10)
  $s.x = 3
  expect($child()).toBe(15)

  const $whole = $C(() => $s().x + $s().y)
  expect($whole()).toBe(8)
  $s.y = 7
  expect($whole()).toBe(10)
})

test('writing a computed is a no-op', () => {
  const $a = signal(1)
  const $c = $C(() => $a() + 1)
  expect($c()).toBe(2)
  expect($c(99)).toBeUndefined()
  expect($c()).toBe(2)
})

test('$C notifies observers, and stops after unsubscribe', () => {
  const $a = signal(1)
  const $c = $C(() => $a() * 3)
  let viaObserve = 0
  let viaObserveNow = 0
  const un = observe($c, () => viaObserve++)
  const unNow = observeNow($c, () => viaObserveNow++)

  expect(viaObserve).toBe(0) // observe does not fire immediately
  expect(viaObserveNow).toBe(1) // observeNow does

  $a(2)
  expect(viaObserve).toBe(1)
  expect(viaObserveNow).toBe(2)

  un()
  $a(3)
  expect(viaObserve).toBe(1)
  expect(viaObserveNow).toBe(3)

  unNow()
  $a(4)
  expect(viaObserveNow).toBe(3)
})

test('$C exposes the signal protocol (subscribe, trigger signature, primitive)', () => {
  const $a = signal(1)
  const $c = $C(() => $a() + 1)

  let notified = 0
  const un = subscribe($c, () => notified++)
  $a(2)
  expect(notified).toBe(1)
  un()

  expect($c.get()).toBe(3)
  expect($c[Symbol.toPrimitive]()).toBe(3)
})

test('$CE is eager: it recomputes without being read', () => {
  const $a = signal(1)
  let runs = 0
  const $c = $CE(() => {
    runs++
    return $a() + 1
  })

  expect(runs).toBe(1) // evaluated at creation
  $a(2)
  expect(runs).toBe(2)
  expect($c()).toBe(3)
})

test('$CE with declared dependencies keeps the declared invalidation', () => {
  const $s = $State({ x: 1, y: 1 })
  let runs = 0
  const $x = $CE(() => {
    runs++
    return $s.x()
  }, $s)

  const before = runs
  let fired = 0
  observe($x, () => fired++)

  $s.y = 2 // declared but never read
  expect(runs).toBeGreaterThan(before) // still recomputes
  expect(fired).toBe(0) // but an unchanged value notifies nobody

  $s.x = 5
  expect($x()).toBe(5)
  expect(fired).toBe(1)
})

test('dispose releases a computed dependency subscriptions', () => {
  const $a = signal(1)
  let runs = 0
  const $c = $C(() => {
    runs++
    return $a() + 1
  })
  expect($c()).toBe(2)
  const before = runs

  dispose($c)
  $a(2)
  expect(runs).toBe(before)
  dispose(undefined) // tolerates a missing node
})

test('batch coalesces writes and hides intermediate values', () => {
  const $s = $State({ x: 1, y: 1 })
  const $sum = $S(() => $s.x() + $s.y(), $s)
  const seen = []
  observe($sum, () => seen.push($sum()))

  batch(() => {
    $s.x = 2
    $s.y = 3
  })

  expect(seen).toEqual([5]) // one notification, no intermediate value
  expect($sum()).toBe(5)
})

test('batch is exception safe', () => {
  const $s = $State({ x: 1 })
  const $d = $S(() => $s.x() * 2, $s)
  expect($d()).toBe(2)

  expect(() =>
    batch(() => {
      $s.x = 2
      throw new Error('boom')
    }),
  ).toThrow('boom')

  expect($d()).toBe(4) // the batch closed, so later writes still propagate
  $s.x = 3
  expect($d()).toBe(6)
})

test('union dependencies: an omitted read is still tracked', () => {
  const $a = signal(1)
  const $b = signal(2)
  // The omission is the point of the test: since 1.9 an undeclared read is tracked as well, so the
  // dependency rule's advice is stylistic rather than a correctness requirement.
  // eslint-disable-next-line jsx6/signal-dependencies -- deliberately omitted on purpose
  const $sum = $S(() => $a() + $b(), $a)

  expect($sum()).toBe(3)
  $b(20)
  expect($sum()).toBe(21)
})

test('union dependencies: nested derived signals are tracked through', () => {
  const $a = signal(1)
  const $inner = $S(() => $a() * 2, $a)
  // `$S(fn)` with a single argument holds the function as a value (see the documented ambiguity), so a
  // dependency-free derived signal is expressed with `$C`, or with `$S(fn, $inner)`.
  const $outer = $C(() => $inner() + 1)
  expect($outer()).toBe(3)
  $a(5)
  expect($outer()).toBe(11)

  const $declared = $S(() => $inner() + 1, $inner)
  expect($declared()).toBe(11)
  $a(6)
  expect($declared()).toBe(13)
})

test('$F passes values, and a single static value is returned as-is', () => {
  const $a = signal(2)
  expect($F((v, w) => v + w, $a, 3)()).toBe(5)
  // One static argument takes the "static value" branch: the filter is not applied, the value is
  // returned unchanged. That is 1.8.18 behaviour and is deliberately preserved.
  expect($F(v => v + 1, 1)()).toBe(1)
})

test('mergeValue inside one batch settles a derived once', () => {
  const $s = $State({ firstName: 'John', lastName: 'Doe' })
  const $full = $S(() => `${$s.firstName()} ${$s.lastName()}`, $s)
  let fired = 0
  observe($full, () => fired++)

  mergeValue($s, { firstName: 'Jane', lastName: 'Smith' })
  expect($full()).toBe('Jane Smith')
  expect(fired).toBe(1)
})

test('a computed depending on another computed orders correctly inside a batch', () => {
  const $s = $State({ a: 1, b: 2 })
  const $sum = $S(() => $s.a() + $s.b(), $s)
  const $double = $S(() => $sum() * 2, $sum)
  const seen = []
  observe($double, () => seen.push($double()))

  batch(() => {
    $s.a = 10
    $s.b = 20
  })

  expect(seen).toEqual([60])
})

test('a declared dependency the callback never reads is still subscribed', () => {
  // The duck-typed shape used by `@jsx6/jsx6`'s translation signal: the read is a plain function call,
  // so the collector cannot see it and the declared list is the only way the derived signal can learn
  // that the value changed. (Regression test: the tracked set alone used to be treated as proof that
  // the subscription set was correct, which left this signal subscribed to nothing.)
  let value = 1
  const listeners = new Set()
  const fake = () => value
  fake[subscribeSymbol] = cb => {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }

  const $derived = $S(() => fake() * 2, fake)
  expect($derived()).toBe(2)
  expect(listeners.size).toBe(1)

  value = 3
  listeners.forEach(cb => cb())
  expect($derived()).toBe(6)

  value = 5
  listeners.forEach(cb => cb())
  expect($derived()).toBe(10)
})

test('$F with a duck-typed dependency behaves the same', () => {
  let value = 2
  const listeners = new Set()
  const fake = () => value
  fake[subscribeSymbol] = cb => {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }

  const $mapped = $F(v => v * 10, fake)
  expect($mapped()).toBe(20)
  value = 4
  listeners.forEach(cb => cb())
  expect($mapped()).toBe(40)
})

test('a computed cycle is reported once and still returns the previous value', () => {
  // The re-entrancy guard exists so a cyclic graph cannot hang or overflow. That makes the failure
  // silent by nature, so it is logged — once — because a wrong value with no message is the hardest
  // kind of bug to find in a computed signal.
  const errors = captureConsoleError(() => {
    let $self
    $self = $C(() => $self() + 1)

    const first = $self() // reads itself while computing: guard hits, previous value is undefined
    const second = $self() // the guard hits again, but the report is not repeated
    expect(Number.isNaN(first)).toBe(true)
    expect(Number.isNaN(second)).toBe(true)
  })

  expect(errors.length).toBe(1)
  expect(errors[0]).toContain('was read while it was computing')
  expect(errors[0]).toContain('cyclic')
})

test('a mutual computed cycle is reported and does not overflow', () => {
  const errors = captureConsoleError(() => {
    let $a
    let $b
    $a = $C(() => $b() + 1)
    $b = $C(() => $a() + 1)

    expect(Number.isNaN($a())).toBe(true)
    expect(Number.isNaN($b())).toBe(true)
  })

  expect(errors.length).toBeGreaterThan(0)
  expect(errors.join('\n')).toContain('was read while it was computing')
})

test('a healthy computed never reports anything, even when read a lot', () => {
  const errors = captureConsoleError(() => {
    const $a = signal(1)
    const $sum = $C(() => $a() + 1)
    for (let i = 0; i < 50; i++) {
      $a(i)
      $sum()
    }
  })

  expect(errors).toEqual([])
})

test('dependency tracking is inert outside a computation', () => {
  const $a = signal(1)
  const collector = new Set()
  const stop = collectStart(collector)
  $a()
  stop()
  expect(collector.has($a)).toBe(true)

  const outside = new Set()
  void outside
  expect(collector.size).toBe(1)
})
