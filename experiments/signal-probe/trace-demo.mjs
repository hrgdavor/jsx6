/**
 * `traceSignal` end to end: the wrapper signal, with the clickable compute reference.
 *
 * Run: bun experiments/signal-probe/trace-demo.mjs
 */
import { $C, $State, batch, signal, traceSignal, traceSignals } from '../../libs/signal/index.js'

// A named function so the getter reference has a *name* in the console: `getter: ƒ discountedTotal`.
function discountedTotal() {
  return this.items + this.tax
}

console.log('\n=== 0. nothing is paid until asked =========================================')
const $plain = signal(1, 'plain')
console.log('signal meta attached before traceSignals():', Object.getOwnPropertySymbols($plain).length, 'symbols')

console.log('\n=== 1. wrap a computed: read + write activations ===========================')
const $a = signal(1, 'a')
const $b = signal(2, 'b')
const $sum = $C(() => $a() + $b(), 'sum')
const $w = traceSignal($sum, { label: 'sum', max: 6 })

console.log('read  ->', $w())
$b(20) // lazy computed: no recompute yet, so no activation
console.log('read  ->', $w())

console.log('\n=== 2. the wrapper is a drop-in signal (the graph flows through it) ========')
const $double = $C(() => $w() * 2, 'double')
console.log('double =', $double())
$b(30)
console.log('double after write =', $double())

console.log('\n=== 3. show(): the plain object whose `getter` is clickable ===============')
const snap = $w.show()
console.log('  getter is the compute function:', snap.getter?.name || '(anonymous)')
console.log('  deps:', snap.deps, ' depth:', snap.depth, ' listeners:', snap.listeners)

console.log('\n=== 4. a traceSignal around a getter, so the source reference is the getter ==')
const $items = signal(3, 'items')
const $tax = signal(1, 'tax')
const $traced = traceSignal(() => $items() + $tax(), {
  label: 'discountedTotal',
  getter: discountedTotal, // the reference DevTools will render with its own name
  max: 2,
})
console.log('value =', $traced())
$tax(2)
console.log('value =', $traced())
$traced.show()

console.log('\n=== 5. $State child: the proxy writes the RAW child, not a wrapper =========')
const $s = $State({ n: 1 })
const $sn = traceSignal($s.n, { label: '$s.n', origins: true, max: 4 })
$sn() // read activates
$s.n = 1 // same value: the === guard means no activation either way
$s.n = 5 // the proxy set trap writes the raw child signal, so the wrapper never sees this
$sn(9) // writing THROUGH the wrapper is what it can observe
console.log('  activations:', $sn.activations(), '— of which reads:', 1, 'write via proxy: invisible')
console.log('  (limitation, not a defect: a wrapper observes what is routed through it)')

console.log('\n=== 6. warn mode, plus onActivate that ignores `max` ======================')
const $noisy = signal(0, 'noisy')
const seen = []
const $wn = traceSignal($noisy, {
  label: 'noisy',
  warn: true,
  max: 2,
  onActivate: info => seen.push(info.activation),
})
$wn(1)
$wn(2)
$wn(3)
$wn(4)
console.log('  all activations seen by onActivate:', seen, '(max only silences the console sink)')

console.log('\n=== 7. a session: origins and dependencies through the internals ==========')
traceSignals({ origin: true, listeners: true })
const $tracked = signal(0, 'tracked')
const $seen = $C(() => $tracked() + 1, 'seen')
$seen()
const meta = (await import('../../libs/signal/src/trace.js')).signalTrace($tracked)
console.log('  created at   :', meta.origin.text)
console.log('  listeners    :', meta.listeners.size)
console.log('  computed dep :', (await import('../../libs/signal/src/trace.js')).signalTrace($seen).deps().tracked.map(d => d.label))
traceSignals(false)

console.log('\n=== 8. batch: the wrapper reports nothing extra for a coalesced write ======')
const $x = signal(0, 'x')
const $y = signal(0, 'y')
const $t = traceSignal($C(() => $x() + $y(), 'xy'), { label: 'xy', max: 8 })
$t()
batch(() => {
  $x(1)
  $y(2)
})
console.log('after one batch:', $t())
