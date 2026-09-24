/**
 * The narrow question: what do the added tracing hooks cost on the paths they touch?
 *
 * The full-suite A/B in `bench-ab.mjs` cannot answer it — its numbers move by tens of percent between
 * passes, which is machine noise, not the change. So this file measures the *exact* code that changed,
 * in a bounded loop with rotating order:
 *
 *   signal(value, name)   gained  `name && signalsTraced`
 *   prepareSignal         gained  the same test, once
 *   createComputed        gained  `if (signalsTraced) { … }`
 *
 * plus the calibration that makes the result interpretable: an empty function call, which is a
 * *bigger* unit of work than either test. If the measured cost is inside that, the hook is free.
 *
 * Run: bun experiments/signal-probe/bench-hooks.mjs
 */
const load = rel => import(new URL(rel, import.meta.url).href)
const A = await load('./before/index.js') // HEAD
const B = await load('./after/index.js') // working tree

const ROUNDS = 40
const PER_SAMPLE = 50_000

const timeOnce = fn => {
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const best = xs => Math.min(...xs)

/** Rotate the order so neither side is always measured first. */
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
  return { ba, bb, delta: ((bb - ba) / ba) * 100, ma: median(a), mb: median(b) }
}

const row = (name, r, note = '') =>
  `${name.padEnd(30)} before ${r.ba.toFixed(2)}ms  after ${r.bb.toFixed(2)}ms  ` +
  `Δ${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(1)}%   (median Δ${(((r.mb - r.ma) / r.ma) * 100).toFixed(1)}%) ${note}`

console.log(`\n=== the two added boolean tests, measured directly (${PER_SAMPLE} iterations/sample, best of ${ROUNDS}) ===`)

// 1. calibration: how long is one empty function call? (the unit the hooks are compared against)
{
  const f = () => {}
  let sink = 0
  const t = timeOnce(() => {
    for (let i = 0; i < PER_SAMPLE; i++) sink += f(i) || 0
  })
  console.log(`calibration: ${PER_SAMPLE} empty function calls = ${t.toFixed(2)}ms  (${((t / PER_SAMPLE) * 1e6).toFixed(1)}ns each)`)
}

// 2. named signal creation (gained `name && signalsTraced`)
{
  const r = compare(
    () => {
      let sink = 0
      for (let i = 0; i < PER_SAMPLE; i++) sink += A.signal(i, 'n')()
      return sink
    },
    () => {
      let sink = 0
      for (let i = 0; i < PER_SAMPLE; i++) sink += B.signal(i, 'n')()
      return sink
    },
  )
  console.log(row('create named signal', r, '← the hook under test'))
}

// 3. anonymous creation (the `name &&` short-circuit)
{
  const r = compare(
    () => {
      let sink = 0
      for (let i = 0; i < PER_SAMPLE; i++) sink += A.signal(i)()
      return sink
    },
    () => {
      let sink = 0
      for (let i = 0; i < PER_SAMPLE; i++) sink += B.signal(i)()
      return sink
    },
  )
  console.log(row('create anonymous signal', r))
}

// 4. the hot path: no creation at all. Should be identical — nothing was added here.
{
  const $a = A.signal(0)
  const $b = B.signal(0)
  const r = compare(
    () => {
      let sink = 0
      for (let i = 0; i < PER_SAMPLE; i++) {
        $a(i)
        sink += $a()
      }
      return sink
    },
    () => {
      let sink = 0
      for (let i = 0; i < PER_SAMPLE; i++) {
        $b(i)
        sink += $b()
      }
      return sink
    },
  )
  console.log(row('write+read (no creation)', r, '← untouched by this change'))
}

// 5. computed creation + recomputation
{
  const mk = api => {
    const $s = api.signal(0, 's')
    return api.$C(() => $s() + 1, 'c')
  }
  const r = compare(
    () => {
      let sink = 0
      for (let i = 0; i < 20_000; i++) sink += mk(A)()
      return sink
    },
    () => {
      let sink = 0
      for (let i = 0; i < 20_000; i++) sink += mk(B)()
      return sink
    },
  )
  console.log(row('create+read $C 20k', r))
}

// 6. the `$State` proxy's set trap — the one hot path this feature touches, even when unused
{
  const state = api => {
    const $s = api.$State({ a: 1, b: 2, c: 3 })
    return $s
  }
  const $sa = state(A)
  const $sb = state(B)
  const r = compare(
    () => {
      for (let i = 0; i < PER_SAMPLE; i++) $sa.a = i
    },
    () => {
      for (let i = 0; i < PER_SAMPLE; i++) $sb.a = i
    },
  )
  console.log(row('$State field write', r, '← trap gained one guarded call'))

  const r2 = compare(
    () => {
      for (let i = 0; i < PER_SAMPLE / 5; i++) A.mergeValue($sa, { a: i, b: i, c: i })
    },
    () => {
      for (let i = 0; i < PER_SAMPLE / 5; i++) B.mergeValue($sb, { a: i, b: i, c: i })
    },
  )
  console.log(row('$State mergeValue', r2))
}

// 7. which part of an *enabled* session is expensive: the record, or the stack walk?
console.log('\n=== what the enabled path costs, split by part (after build, 50k named signals) ===')
const run = mode => {
  B.traceSignals(mode)
  const ms = timeOnce(() => {
    let sink = 0
    for (let i = 0; i < 50_000; i++) sink += B.signal(i, 'n')()
    return sink
  })
  B.traceSignals(false)
  return ms
}
const parts = [
  ['off', false],
  ['lean', { origin: false }],
  ['full', { origin: true }],
]
const samples = { off: [], lean: [], full: [] }
for (const [key, mode] of parts) run(mode)
for (let i = 0; i < 21; i++) {
  for (const [key, mode] of [parts[i % 3], parts[(i + 1) % 3], parts[(i + 2) % 3]]) samples[key].push(run(mode))
}
const base = best(samples.off)
for (const [key, label] of [
  ['off', 'tracing off'],
  ['lean', 'record only (no stack walk)'],
  ['full', 'record + origin stack walk'],
]) {
  const b = best(samples[key])
  console.log(`  ${label.padEnd(28)} ${b.toFixed(2)}ms  (+${(((b - base) / base) * 100).toFixed(0)}%)`)
}
