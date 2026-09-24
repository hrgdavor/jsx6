/**
 * Focused A/B on the one hot path the state feature touches: the `$State` proxy's `set` trap.
 *
 * The trap gained `if (hasStateWriteObservers() && !Object.is(child(), value))` — one guarded call.
 * A tight, bounded, order-rotating loop is the only way to see a difference this small.
 *
 * Run: bun experiments/signal-probe/bench-state-trap.mjs
 */
const load = rel => import(new URL(rel, import.meta.url).href)
const A = await load('./before/index.js') // HEAD, no hook
const B = await load('./after/index.js') // working tree, hook added

const ROUNDS = 60
const PER_SAMPLE = 200_000

const timeOnce = fn => {
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const best = xs => Math.min(...xs)

const compare = (workA, workB) => {
  workA()
  workB()
  const a = []
  const b = []
  for (let i = 0; i < ROUNDS; i++) {
    if (i % 2 === 0) {
      a.push(timeOnce(workA))
      b.push(timeOnce(workB))
    } else {
      b.push(timeOnce(workB))
      a.push(timeOnce(workA))
    }
  }
  const ba = best(a)
  const bb = best(b)
  return {
    ba,
    bb,
    bestDelta: ((bb - ba) / ba) * 100,
    ma: median(a),
    mb: median(b),
    medDelta: ((median(b) - median(a)) / median(a)) * 100,
  }
}

const row = (name, r) =>
  `${name.padEnd(26)} before ${r.ba.toFixed(2)} / ${r.ma.toFixed(2)}ms   after ${r.bb.toFixed(2)} / ${r.mb.toFixed(2)}ms   ` +
  `Δbest ${r.bestDelta >= 0 ? '+' : ''}${r.bestDelta.toFixed(1)}%   Δmedian ${r.medDelta >= 0 ? '+' : ''}${r.medDelta.toFixed(1)}%`

const $sa = A.$State({ a: 1, b: 2, c: 3 })
const $sb = B.$State({ a: 1, b: 2, c: 3 })

console.log(`\n=== $State set trap: ${PER_SAMPLE} writes/sample, best+median of ${ROUNDS} ===`)
console.log(row('field write  $s.a = i', compare(() => {
  for (let i = 0; i < PER_SAMPLE; i++) $sa.a = i
}, () => {
  for (let i = 0; i < PER_SAMPLE; i++) $sb.a = i
})))

console.log(row('mergeValue 3 fields', compare(() => {
  for (let i = 0; i < PER_SAMPLE / 5; i++) A.mergeValue($sa, { a: i, b: i, c: i })
}, () => {
  for (let i = 0; i < PER_SAMPLE / 5; i++) B.mergeValue($sb, { a: i, b: i, c: i })
})))

console.log(row('new child $s.new = i', compare(() => {
  for (let i = 0; i < PER_SAMPLE / 10; i++) $sa.fresh = i
}, () => {
  for (let i = 0; i < PER_SAMPLE / 10; i++) $sb.fresh = i
})))

console.log(row('setValue $s({a:i})', compare(() => {
  for (let i = 0; i < PER_SAMPLE / 5; i++) $sa({ a: i })
}, () => {
  for (let i = 0; i < PER_SAMPLE / 5; i++) $sb({ a: i })
})))

console.log('\n=== and with an observer registered (after build only) ===')
const stop = B.onStateWrite(() => {})
const withObs = []
const without = []
B.onStateWrite(() => {}) // keep one registered for the "with" measurement
for (let i = 0; i < 20; i++) {
  withObs.push(timeOnce(() => {
    for (let i = 0; i < PER_SAMPLE; i++) $sb.a = i
  }))
  stop()
  without.push(timeOnce(() => {
    for (let i = 0; i < PER_SAMPLE; i++) $sb.a = i
  }))
}
console.log(`field write: no observer ${best(without).toFixed(2)}ms   with observer ${best(withObs).toFixed(2)}ms`)
