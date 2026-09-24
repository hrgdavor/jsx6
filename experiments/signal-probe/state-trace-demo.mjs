/**
 * `$State` + `traceSignal` end to end.
 *
 * Run: bun experiments/signal-probe/state-trace-demo.mjs
 */
import { $C, $State, batch, mergeValue, traceSignal } from '../../libs/signal/index.js'

const sink = () => {
  const lines = []
  return { lines, log: (...a) => lines.push(a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')) }
}

console.log('\n=== 1. wrap the state: reads, and writes through the proxy ================')
const out = sink()
const $s = $State({ count: 0, name: 'ada' })
const $t = traceSignal($s, { label: 'cart', log: out.log, max: 20 })

console.log('read  ->', JSON.stringify($t()))
$t.count = 1
$t.count = 1 // unchanged: the === guard means no report
$t.count = 2
$t.name = 'grace'
console.log(out.lines.join('\n'))

console.log('\n=== 2. mergeValue: one report per changed child ===========================')
out.lines.length = 0
mergeValue($t, { count: 5, name: 'alan' })
console.log(out.lines.join('\n'))

console.log('\n=== 3. setValue resets missing keys to undefined ==========================')
out.lines.length = 0
$t({ count: 9 }) // `name` is absent -> reset to undefined, and that is a real write
console.log(out.lines.join('\n'))
console.log('snapshot now:', JSON.stringify($t()))

console.log('\n=== 4. batch: writes are still reported, the derived value settles once ===')
out.lines.length = 0
const $sum = $C(() => ($t.count ? $t.count() : 0) + ($t.name ? 1 : 0), 'sum')
const $wt = traceSignal($sum, { label: 'sum', log: out.log, max: 20 })
console.log('sum before:', $wt())
out.lines.length = 0
batch(() => {
  $t.count = 100
  $t.name = 'batch'
})
console.log(out.lines.join('\n'))
console.log('sum after batch:', $sum(), '(one settle, two field writes)')

console.log('\n=== 5. snapshot of a state: children are the dependencies ==================')
console.log(JSON.stringify($t.snapshot(), null, 1).replace(/\n\s*/g, ' '))

console.log('\n=== 6. two states, same field name: identity filtering ====================')
out.lines.length = 0
const $other = traceSignal($State({ count: 0 }), { label: 'other', log: out.log, max: 10 })
$other.count = 7
console.log(out.lines.join('\n'), '← the first state heard nothing')

console.log('\n=== 6b. disposing one wrapper stops its reports ===========================')
out.lines.length = 0
const $second = traceSignal($s, { label: 'second', log: out.log, max: 10 })
$s.count = 55
console.log(out.lines.filter(l => l.includes('write')).length, 'reports while two wrappers watch')
out.lines.length = 0
$second.dispose()
$s.count = 56
console.log(out.lines.filter(l => l.includes('write')).length, 'reports after disposing the second')

console.log('\n=== 7. dispose removes the observer (no accumulation) =====================')
out.lines.length = 0
const before = out.lines.length
$t.dispose()
$t.count = 123
console.log('reports after dispose:', out.lines.length - before, '(expected 0)')
console.log('the state still works: count =', $s.count())

console.log('\n=== 8. an unobserved state pays nothing extra =============================')
const $plain = $State({ a: 1 })
const t0 = performance.now()
for (let i = 0; i < 200_000; i++) $plain.a = i
const ms = performance.now() - t0
console.log(`200k writes to an untraced state: ${ms.toFixed(2)}ms`)
