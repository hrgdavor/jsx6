/**
 * Is the depth ordering correct for the shapes apps actually use ($CE / $S), and does a batch
 * with a lazy chain evaluate in the right order?
 *
 * Run: bun experiments/signal-probe/chain-check2.mjs
 */
import { signal, $C, $CE, $S, batch } from '../../libs/signal/index.js'

// eager chain, the $S/$F shape
const order = []
const $a = signal(1, 'a')
const $b = $CE(() => {
  order.push('b')
  return $a() + 1
}, 'b')
const $c = $CE(() => {
  order.push('c')
  return $b() + 1
}, 'c')
const $d = $CE(() => {
  order.push('d')
  return $c() + 1
}, 'd')
console.log('eager depths: b=%s c=%s d=%s (expected 1, 2, 3)', $b.__depth, $c.__depth, $d.__depth)
order.length = 0
batch(() => {
  $a(2)
})
console.log('eager batch order:', order, '(expected b, c, d)')

// $S chain: created bottom-up, which is the normal code order
const $s1 = $S(() => $a() + 1, $a)
const $s2 = $S(() => $s1() + 1, $s1)
const $s3 = $S(() => $s2() + 1, $s2)
console.log('$S depths: 1=%s 2=%s 3=%s (expected 1, 2, 3)', $s1.__depth, $s2.__depth, $s3.__depth)

// lazy chain created *bottom-up* (each node evaluated before the next is created)
const $l1 = $C(() => $a() + 1, 'l1')
$l1()
const $l2 = $C(() => $l1() + 1, 'l2')
$l2()
const $l3 = $C(() => $l2() + 1, 'l3')
$l3()
console.log('lazy bottom-up depths: l1=%s l2=%s l3=%s (expected 1, 2, 3)', $l1.__depth, $l2.__depth, $l3.__depth)

// lazy chain created *top-down* (the order where d is made before anything is read)
const $m3 = $C(() => $m2() + 1, 'm3')
const $m2 = $C(() => $m1() + 1, 'm2')
const $m1 = $C(() => $a() + 1, 'm1')
$m3()
console.log('lazy top-down depths: m1=%s m2=%s m3=%s (expected 1, 2, 3)', $m1.__depth, $m2.__depth, $m3.__depth)

// does the wrong depth actually mis-order a batch flush?
const seen = []
const $n1 = $C(() => {
  seen.push('n1')
  return $a()
}, 'n1')
const $n2 = $C(() => {
  seen.push('n2')
  return $n1() + 1
}, 'n2')
const $n3 = $C(() => {
  seen.push('n3')
  return $n2() + 1
}, 'n3')
$n3() // warm
const stop = $n2[Symbol.for('signalSubscribe')](() => {}) // keep n2 hot so it settles
seen.length = 0
batch(() => {
  $a(3)
})
console.log('lazy-chain batch settle order:', seen, 'depths n2=%s n3=%s', $n2.__depth, $n3.__depth)
console.log('n3 after batch (read outside):', $n3())
stop()
