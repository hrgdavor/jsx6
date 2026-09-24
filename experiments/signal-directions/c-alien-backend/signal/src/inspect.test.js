/**
 * Console inspection: the `value` getter, which is what any tooling reads.
 *
 * The contract this pins down:
 *   - it exists on plain signals, on computeds, and on `$State` child signals;
 *   - it is a *getter*, so it is evaluated when it is read — a signal logged early and read later shows
 *     the value it has then;
 *   - it is non-enumerable, so it cannot leak into Object.keys, spread, `for...in` or JSON;
 *   - the supported way to read a signal in application code stays `$signal()`.
 *
 * Making bare `console.log($sig)` readable needs more than this getter — Chrome does not list a
 * function's own properties — which is what `installConsoleInspection()` in `src/debug.js` is for.
 */

import { expect, test } from 'bun:test'
import { $C, $S, $State, signal, staticSignal } from '../index.js'

test('a signal exposes its current value under `value`', () => {
  const $a = signal(1)

  expect($a.value).toBe(1)
  $a(5)
  expect($a.value).toBe(5)

  // The same object keeps reporting the current value: it is a getter, not a snapshot.
  const logged = $a
  $a(9)
  expect(logged.value).toBe(9)
  expect(logged()).toBe(9)
})

test('`value` is a getter, not a stored property', () => {
  const $a = signal(1)
  const descriptor = Object.getOwnPropertyDescriptor($a, 'value')

  expect(typeof descriptor.get).toBe('function')
  expect(descriptor.set).toBeUndefined() // a signal is not written through `.value`
  expect(descriptor.enumerable).toBe(false)
})

test('`value` stays out of enumeration, spread and JSON', () => {
  const $a = signal(7)

  // `get` is a pre-existing enumerable property of every signal; `value` must not join it.
  expect(Object.keys($a)).not.toContain('value')
  expect({ ...$a }).not.toHaveProperty('value')
  expect(JSON.stringify({ sig: $a })).toBe('{}')
  expect('value' in $a).toBe(true) // present, just not enumerated
})

test('a computed exposes its current value under `value`', () => {
  const $a = signal(2)
  const $double = $C(() => $a() * 2)

  expect($double.value).toBe(4)
  $a(3)
  expect($double.value).toBe(6)
})

test('inspecting a lazy computed evaluates it, like any other read', () => {
  const $a = signal(1)
  let runs = 0
  const $c = $C(() => {
    runs++
    return $a() + 1
  })

  expect(runs).toBe(0)
  expect($c.value).toBe(2) // the console expanding it is a read
  expect(runs).toBe(1)
  $a(10)
  expect($c.value).toBe(11)
})

test('`value` works on the other signal flavours too', () => {
  const $s = $State({ n: 1 })
  expect($s.n.value).toBe(1) // a $State child is a plain signal

  // The state proxy is not a plain signal: reading an unknown key hands back a lazily created child
  // signal (pre-existing proxy behaviour), so `$s.value` is a signal, not the snapshot. Read the whole
  // state with `$s()` or JSON instead. A read alone does not add a field to the state.
  expect(typeof $s.value).toBe('function')
  expect($s()).toEqual({ n: 1 })

  const $sum = $S(() => $s.n() + 1, $s)
  expect($sum.value).toBe(2)
  $s.n = 5
  expect($sum.value).toBe(6)
})

test('a $State is coercible, so it can be printed', () => {
  // Regression: `Symbol.toPrimitive` used to hand back the snapshot *object*, so every coercion of a
  // state threw `TypeError: Symbol.toPrimitive returned an object` — which made a state unusable in a
  // template literal or `String(...)` in the console. Child signals were never affected (`$s.n++` works
  // through the child's own hook).
  const $s = $State({ n: 1 })

  expect(String($s)).toBe('{"n":1}')
  expect(`${$s}`).toBe('{"n":1}')
  expect($s + '').toBe('{"n":1}')
  expect(Number.isNaN(+$s)).toBe(true)
  expect(JSON.stringify($s)).toBe('{"n":1}')

  $s.n = 2
  expect(String($s)).toBe('{"n":2}') // current, because it is computed on coercion
  expect($s.n++).toBe(2)
  expect($s.n()).toBe(3)
})

test('the constant wrapper keeps its minimal shape', () => {
  // `staticSignal` wraps a value that can never change, is created on warm paths (`asSignal` routes
  // plain values through it), and deliberately carries only the protocol, not the inspection getter.
  const $static = staticSignal(3)
  expect($static()).toBe(3)
  expect($static.get()).toBe(3)
  expect($static[Symbol.toPrimitive]()).toBe(3)
  expect('value' in $static).toBe(false)
})

