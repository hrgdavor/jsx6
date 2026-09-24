/**
 * Proof: what can the *existing* collector mechanism answer, with no change to libs/signal?
 *
 * Run: bun experiments/signal-probe/check.mjs
 */
import { signal, $C, $CE, $S, $State } from '../../libs/signal/index.js'
import { trackState } from '../../libs/signal/src/track.js'

/** Run `probe` inside a fresh collector and report what it read. */
const collectReads = probe => {
  const into = new Set()
  const prev = trackState.collector
  trackState.collector = into
  let value
  try {
    value = probe()
  } finally {
    trackState.collector = prev
  }
  return { value, reads: into }
}

const names = set => [...set].map(s => s.label || s.name || '?')

const readDeps = $s => names(collectReads($s).reads)

const $a = signal(1, 'a')
const $b = signal(2, 'b')
const $sum = $C(() => $a() + $b(), 'sum')
const $double = $C(() => $sum() * 2, 'double')
const $declared = $S(() => $a() + $b(), $a, $b) // collectDeps: 'first'

console.log('\n=== A. no warm-up: a *cold lazy* computed hides its reads in its own recompute ===')
console.log('  $sum (cold)    ->', readDeps($sum)) // expect only $sum itself
console.log('  $sum (warm)    ->', readDeps($sum))

console.log('\n=== B. warm computeds: reads escape to the caller collector (collectDeps: always) ===')
console.log('  $double        ->', readDeps($double))
console.log('  $double value  ->', collectReads($double).value)

console.log('\n=== C. a computed with a declared list (collectDeps: first) still escapes reads ===')
$declared()
console.log('  $declared      ->', readDeps($declared))

console.log('\n=== D. recursive walk for free (nested reads land in the same collector) ===')
console.log('  $double chain  ->', readDeps(() => $double()))

console.log('\n=== E. conditional dependency, per activation, on a cold lazy computed ===')
const $flag = signal(true, 'flag')
const $cond = $C(() => ($flag() ? $a() : $b()), 'cond')
$cond() // its own collection: first pass, flag=true
console.log('  warmed, flag=true  ->', readDeps($cond))
$flag(false)
console.log('  flag=false, dirty   ->', readDeps($cond))
console.log('  flag=false, warm    ->', readDeps($cond))

console.log('\n=== F. depth: only exists on computeds, and only after evaluation ===')
console.log('  before: $a.__depth =', $a.__depth, ' $sum.__depth =', $sum.__depth, ' $double.__depth =', $double.__depth)
$double()
console.log('  after : $a.__depth =', $a.__depth, ' $sum.__depth =', $sum.__depth, ' $double.__depth =', $double.__depth)

console.log('\n=== G. a probe computed: log on change, using only the existing protocol ===')
const log = []
const $probe = $CE(() => {
  const v = $b()
  log.push(v)
  return v
}, 'probeB')
console.log('  after creation    :', log, '| probe value:', $probe())
$b(20)
console.log('  after $b(20)      :', log)
$b(20)
console.log('  after $b(20) again:', log, '<- the === guard means the probe did not run')
const capped = []
const $cap = $CE(() => {
  const v = $b()
  capped.push(v)
  capped.length = 8 // what a bounded log costs: three tokens
  return v
}, 'capped')
$b(21)
$b(22)
console.log('  capped log        :', capped)

console.log('\n=== H. $State and derived ===')
const $s = $State({ n: 1, m: 2 })
const $sSum = $C(() => $s.n + $s.m, 'sSum')
$sSum()
console.log('  sSum reads        :', readDeps($sSum), '=', $sSum())

console.log('\n=== I. count recomputations of a lazy computed without touching its code ===')
const $counted = $C(() => $a() * 10, 'counted')
let runs = 0
const $watch = $C(() => {
  runs++
  return $counted()
}, 'watch')
$watch()
console.log('  runs after 1 read :', runs)
$watch()
console.log('  runs after 2 reads:', runs, '<- memoized: the inner getter did not re-run')
$a(5)
console.log('  runs after write  :', runs, '<- lazy: still not re-run until read')
$watch()
console.log('  runs after read   :', runs)
