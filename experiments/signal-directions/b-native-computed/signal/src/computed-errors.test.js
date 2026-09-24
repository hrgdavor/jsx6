/**
 * Failure semantics of a computed whose getter throws.
 *
 * Found while building the console demo, and only in `@jsx6/signal-alien`: alien-signals settles a
 * computed whose getter threw as *clean, value `undefined`*, so a second read silently handed back
 * `undefined` — and the failure surfaced from alien's own dirty-check during a dependency **write**, so
 * writing a signal could throw because some derived value failed. Both are contract, and this pins them
 * for every core.
 */
import { expect, test } from 'bun:test'
import { $C, $CE, observeNow, signal } from '../index.js'

const boom = () => {
  throw new Error('boom')
}

test('a computed that throws reports the failure on every read', () => {
  const $bad = $C(boom)
  expect(() => $bad()).toThrow('boom')
  expect(() => $bad()).toThrow('boom') // never forgotten, never settled to undefined
  expect(() => $bad.value).toThrow('boom') // not hidden by the inspection getter either

  // A parent reading a failing child reports it too, however often it is read.
  const $parent = $C(() => $bad() + 1)
  expect(() => $parent()).toThrow('boom')
  expect(() => $parent()).toThrow('boom')
})

test('a conditional failure recovers when a write fixes the cause', () => {
  const $on = signal(true)
  const $cond = $C(() => {
    if ($on()) throw new Error('cond')
    return 'fine'
  })
  expect(() => $cond()).toThrow('cond')
  $on(false)
  expect($cond()).toBe('fine')
  $on(true)
  expect(() => $cond()).toThrow('cond')
})

test('a write never throws because a derived value failed — the read reports it', () => {
  const $gate = signal(false)
  const $hot = $CE(() => {
    if ($gate()) throw new Error('hot')
    return 'ok'
  })
  expect($hot()).toBe('ok')

  // The write belongs to whoever wrote the signal; the failure belongs to the reader.
  expect(() => $gate(true)).not.toThrow()
  expect(() => $hot()).toThrow('hot')

  expect(() => $gate(false)).not.toThrow()
  expect($hot()).toBe('ok')
})

test('a failing eager recomputation notifies nobody, and recovery is value-guarded', () => {
  const $gate = signal(false)
  const $label = signal('a')
  const $hot = $CE(() => {
    if ($gate()) throw new Error('hot')
    return $label()
  })
  const seen = []
  const un = observeNow($hot, v => seen.push(v))
  expect(seen).toEqual(['a'])

  $gate(true) // fails: a listener is never handed a value from a failed recomputation
  expect(seen).toEqual(['a'])

  $label('b') // still failing, still no notification
  expect(seen).toEqual(['a'])

  $gate(false) // recovers — and the recovered value is announced, once
  expect(seen).toEqual(['a', 'b'])

  $gate(true) // breaks again, no notification
  $gate(false) // recovers to the *same* value, so the value guard stays quiet
  expect(seen).toEqual(['a', 'b'])
  un()
})

test('creating an eager computed whose getter fails throws at creation', () => {
  // So a caller never ends up holding a broken signal it believes is live.
  expect(() => $CE(boom)).toThrow('boom')
})