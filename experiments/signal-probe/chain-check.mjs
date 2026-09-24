/**
 * Does the chain actually propagate? That decides whether __depth is wrong or my expectation is.
 *
 * Run: bun experiments/signal-probe/chain-check.mjs
 */
import { signal, $C, batch, $State, $S } from '../../libs/signal/index.js'

const $a = signal(1, 'a')
const $b = $C(() => $a() * 2, 'b')
const $c = $C(() => $b() + 1, 'c')
const $d = $C(() => $c() + 1, 'd')

console.log('initial chain: b=%s c=%s d=%s', $b(), $c(), $d())
$a(10)
console.log('after $a(10):  b=%s c=%s d=%s', $b(), $c(), $d())
console.log('depths:        b=%s c=%s d=%s', $b.__depth, $c.__depth, $d.__depth)

// does a *listener-having* chain compute depth? subscribe a real callback to the tip
const seen = []
const $e = $C(() => $a() + 100, 'e')
const $f = $C(() => $e() + 1, 'f')
const stop = $f[Symbol.for('signalSubscribe')](() => seen.push('f'))
console.log('after subscribe: e=%s f=%s', $e.__depth, $f.__depth)
$a(11)
console.log('listener fired:', seen.length, 'times; values e=%s f=%s', $e(), $f())
stop()

// $S (eager, declared deps) — the shape most apps use
const $g = $S(() => $a() + 1, $a)
const $h = $S(() => $g() + 1, $g)
console.log('$S chain: g=%s h=%s depths g=%s h=%s', $g(), $h(), $g.__depth, $h.__depth)
$a(12)
console.log('after write: g=%s h=%s', $g(), $h())

// eager $CE chain, and a batch of three writes
const order = []
const $x = $C(() => {
  order.push('x')
  return $a()
}, 'x')
const $y = $C(() => {
  order.push('y')
  return $x() + 1
}, 'y')
$y() // subscribe the tip so both are hot
order.length = 0
batch(() => {
  $a(13)
  $a(14)
})
console.log('batch eval order (lazy tip, read before batch):', order, 'depths x=%s y=%s', $x.__depth, $y.__depth)
