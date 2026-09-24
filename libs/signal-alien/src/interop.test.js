import { expect, test } from 'bun:test'
import {
  $C,
  $F,
  $S,
  $State,
  alien,
  batch,
  dispose,
  isAlienComputed,
  isAlienNode,
  isAlienSignal,
  isObservable,
  observe,
  observeNow,
  signal,
  toAlien,
  toSignal,
} from '../index.js'

test('the callable signals are jsx6 wrappers; toAlien() yields the alien node', () => {
  const $a = signal(1)
  const $c = $C(() => $a() + 1)

  // The public callables keep the full jsx6 signal contract, so alien's name-based brand check does
  // not match them — that is deliberate: `isSignal`/`isComputed` are about *alien's* nodes.
  expect(isAlienSignal($a)).toBe(false)
  expect(isAlienComputed($c)).toBe(false)
  expect(isAlienNode($a)).toBe(false)

  // The backing alien nodes are what alien itself recognises, and toAlien() hands them over.
  expect(isAlienSignal(toAlien($a))).toBe(true)
  expect(isAlienComputed(toAlien($c))).toBe(true)
  expect(isAlienNode(toAlien($c))).toBe(true)

  // ...and a *foreign* alien node (one the application created itself) is recognised too.
  expect(isAlienNode(alien.signal(0))).toBe(true)
  expect(isAlienNode(1)).toBe(false)
  expect(isAlienNode(() => {})).toBe(false)
})

test('an alien computed tracks a bare jsx6 read with no bridge', () => {
  const $a = signal(1)
  const c = alien.computed(() => $a() * 10)

  expect(c()).toBe(10)
  $a(2) // no toAlien() call anywhere
  expect(c()).toBe(20)
})

test('an alien effect tracks a bare jsx6 read with no bridge', () => {
  const $a = signal(1)
  const seen = []
  const stop = alien.effect(() => {
    seen.push($a())
    return undefined
  })

  $a(2)
  $a(3)
  stop()
  $a(4)
  expect(seen).toEqual([1, 2, 3])
})

test('toAlien returns the backing node itself, and caches', () => {
  const $a = signal(1)
  const A = toAlien($a)

  expect(A).not.toBe($a)
  expect(A()).toBe(1)
  $a(2)
  expect(A()).toBe(2)
  expect(toAlien($a)).toBe(A) // zero-cost: no second node
  expect(isAlienSignal(A)).toBe(true)
})

test('toSignal mirrors an alien node into a jsx6 signal, and dispose stops it', () => {
  const a = alien.signal(1)
  const $mirror = toSignal(a)

  expect($mirror()).toBe(1)
  const seen = []
  const un = observe($mirror, () => seen.push($mirror()))
  a(2)
  expect(seen).toEqual([2])

  dispose($mirror)
  a(3)
  un()
  expect(seen).toEqual([2]) // the mirror no longer follows
})

test('a jsx6 derived signal accepts an alien dependency (no static branch)', () => {
  const a = alien.signal(1)
  const $doubled = $F(v => v * 2, a)

  expect(typeof $doubled).toBe('function')
  expect($doubled()).toBe(2)
  a(3)
  expect($doubled()).toBe(6)
})

test('$S accepts alien and jsx6 dependencies side by side', () => {
  const a = alien.signal(1)
  const $b = signal(2)
  const $sum = $S(() => a() + $b(), a, $b)

  expect($sum()).toBe(3)
  a(10)
  expect($sum()).toBe(12)
  $b(20)
  expect($sum()).toBe(30)
})

test('$C can be built over an alien signal', () => {
  const a = alien.signal(2)
  const $square = $C(() => a() * a())

  expect($square()).toBe(4)
  a(3)
  expect($square()).toBe(9)
})

test('an alien computed works where JSX expects a signal (observeNow)', () => {
  const a = alien.signal(1)
  const c = alien.computed(() => a() * 2)
  const seen = []
  const un = observeNow(c, v => seen.push(v))

  expect(seen).toEqual([2]) // immediate value, not the function
  a(4)
  expect(seen).toEqual([2, 8])
  un()
  a(5)
  expect(seen).toEqual([2, 8])
})

test('an alien computed is observable, so jsx2dom binds it instead of rendering it', () => {
  const a = alien.signal(1)
  expect(isObservable(alien.computed(() => a()))).toBe(true)
  expect(isObservable(a)).toBe(true)
  expect(isObservable(1)).toBe(false)
})

test('batch covers alien and jsx6 writes together', () => {
  const a = alien.signal(1)
  const $b = signal(1)
  const $sum = $C(() => a() + $b())
  const seen = []
  const un = observeNow($sum, v => seen.push(v))

  expect(seen).toEqual([2])
  batch(() => {
    a(10)
    $b(20)
  })
  expect(seen).toEqual([2, 30]) // one settled value, no intermediate
  un()
})

test('$State and alien signals interoperate', () => {
  const $s = $State({ n: 2 })
  const a = alien.signal(3)
  const $total = $C(() => $s.n() + a())

  expect($total()).toBe(5)
  $s.n = 4
  expect($total()).toBe(7)
  a(10)
  expect($total()).toBe(14)
})

test('toAlien is not required for the same value to be used by both worlds', () => {
  const $a = signal(1)
  const fromJsx = $C(() => $a() * 2)
  const fromAlien = alien.computed(() => $a() * 3)

  expect(fromJsx()).toBe(2)
  expect(fromAlien()).toBe(3)
  $a(5)
  expect(fromJsx()).toBe(10)
  expect(fromAlien()).toBe(15)
  // one signal, two graphs reading it, no bridge and no duplication
  expect(dispose(fromJsx)).toBeUndefined()
})
