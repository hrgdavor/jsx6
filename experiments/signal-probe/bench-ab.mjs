/**
 * A/B: does the tracing attachment cost anything while tracing is OFF?
 *
 * `before/` is `libs/signal` at HEAD; `after/` is the working tree (tracing hooks added). Both are
 * loaded from their own directory, so the only difference is the hooks.
 *
 * Measurement discipline (the reason earlier runs of this file disagreed with themselves):
 *   - A/B alternate inside one process, so CPU state, GC and JIT are shared;
 *   - the *minimum* of many samples is the headline number (it is the least-noise estimator for a
 *     throughput loop; a slow sample is always interference, never a fast machine);
 *   - mode orders are rotated, so no mode is always measured at the same position in the round;
 *   - the whole suite is run twice, because a single pass cannot tell 2 % from noise.
 *
 * Run: bun experiments/signal-probe/bench-ab.mjs
 */
const load = rel => import(new URL(rel, import.meta.url).href)

const A = await load('./before/index.js')
const B = await load('./after/index.js')

const N = {
  writeRead: 2_000_000,
  create: 200_000,
  chainWrites: 50_000,
  stateMerge: 20_000,
  churn: 20_000,
}

const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const best = xs => Math.min(...xs)
const timeOnce = fn => {
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

/** Alternate A/B, and rotate which side goes first. `min` is the headline. */
const duel = (workA, workB, runs = 15) => {
  workA()
  workB()
  const ta = []
  const tb = []
  for (let i = 0; i < runs; i++) {
    const aFirst = i % 2 === 0
    if (aFirst) {
      ta.push(timeOnce(workA))
      tb.push(timeOnce(workB))
    } else {
      tb.push(timeOnce(workB))
      ta.push(timeOnce(workA))
    }
  }
  const ba = best(ta)
  const bb = best(tb)
  return { ba, bb, ma: median(ta), mb: median(tb), delta: ((bb - ba) / ba) * 100 }
}

const line = (name, r) =>
  `${name.padEnd(26)} best ${r.ba.toFixed(2)} / ${r.bb.toFixed(2)}ms  Δ${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(1)}%` +
  `   median ${r.ma.toFixed(2)} / ${r.mb.toFixed(2)}ms`

const suite = () => {
  const out = {}

  out['write+read 2M'] = duel(
    () => {
      const $a = A.signal(0)
      let sink = 0
      for (let i = 0; i < N.writeRead; i++) {
        $a(i)
        sink += $a()
      }
      return sink
    },
    () => {
      const $a = B.signal(0)
      let sink = 0
      for (let i = 0; i < N.writeRead; i++) {
        $a(i)
        sink += $a()
      }
      return sink
    },
  )

  out['create named 200k'] = duel(
    () => {
      let sink = 0
      for (let i = 0; i < N.create; i++) sink += A.signal(i, 'n')()
      return sink
    },
    () => {
      let sink = 0
      for (let i = 0; i < N.create; i++) sink += B.signal(i, 'n')()
      return sink
    },
  )

  out['create anonymous 200k'] = duel(
    () => {
      let sink = 0
      for (let i = 0; i < N.create; i++) sink += A.signal(i)()
      return sink
    },
    () => {
      let sink = 0
      for (let i = 0; i < N.create; i++) sink += B.signal(i)()
      return sink
    },
  )

  const chain = (api, $a) => {
    const $b = api.$S(() => $a() + 1, $a)
    const $c = api.$S(() => $b() + 1, $b)
    const $d = api.$S(() => $c() + 1, $c)
    api.subscribe($d, () => {})
  }
  out['eager chain 50k writes'] = duel(
    () => {
      const $a = A.signal(0, 'a')
      chain(A, $a)
      for (let i = 0; i < N.chainWrites; i++) $a(i)
    },
    () => {
      const $a = B.signal(0, 'a')
      chain(B, $a)
      for (let i = 0; i < N.chainWrites; i++) $a(i)
    },
  )

  out['observe churn 20k'] = duel(
    () => {
      for (let i = 0; i < N.churn; i++) {
        const $v = A.signal(i, 'v')
        const un = A.observeNow($v, () => {})
        $v(i + 1)
        un?.()
      }
    },
    () => {
      for (let i = 0; i < N.churn; i++) {
        const $v = B.signal(i, 'v')
        const un = B.observeNow($v, () => {})
        $v(i + 1)
        un?.()
      }
    },
  )

  const mergeSetup = api => {
    const $s = api.$State({ a: 1, b: 2, c: 3 })
    const $sum = api.$S(() => $s.a() + $s.b() + $s.c(), $s)
    api.subscribe($sum, () => {})
    return $s
  }
  out['$State merge 20k'] = duel(
    () => {
      const $s = mergeSetup(A)
      for (let i = 0; i < N.stateMerge; i++) A.mergeValue($s, { a: i, b: i, c: i })
    },
    () => {
      const $s = mergeSetup(B)
      for (let i = 0; i < N.stateMerge; i++) B.mergeValue($s, { a: i, b: i, c: i })
    },
  )

  return out
}

for (let pass = 1; pass <= 2; pass++) {
  console.log(`\n=== pass ${pass}: tracing OFF — before (HEAD) vs after (hooks added) ===`)
  for (const [name, r] of Object.entries(suite())) console.log(line(name, r))
}

// ------------------------------------------------------------------------------------------------
// The price when tracing is switched ON. Not a regression — a measured cost, with the expensive part
// (the origin stack walk) separable.
console.log('\n=== tracing ON vs OFF (after build) — the price ===')
const modes = [
  ['off', false],
  ['lean', { origin: false }],
  ['full', { origin: true }],
]
const create50k = mode => {
  B.traceSignals(mode)
  const ms = timeOnce(() => {
    let sink = 0
    for (let i = 0; i < 50_000; i++) sink += B.signal(i, 'n')()
    return sink
  })
  B.traceSignals(false)
  return ms
}
const samples = { off: [], lean: [], full: [] }
for (const [key, mode] of modes) create50k(mode)
for (let i = 0; i < 15; i++) {
  // rotate the order so no mode is always first or last in the round
  const order = [modes[i % 3], modes[(i + 1) % 3], modes[(i + 2) % 3]]
  for (const [key, mode] of order) samples[key].push(create50k(mode))
}
const base = best(samples.off)
for (const [key, label] of [
  ['off', 'tracing off'],
  ['lean', 'on, no origin stack walk'],
  ['full', 'on, origin captured'],
]) {
  const b = best(samples[key])
  console.log(`create 50k named signals:  ${label.padEnd(28)} ${b.toFixed(2)}ms  (+${(((b - base) / base) * 100).toFixed(0)}%)`)
}

// What "on" buys, and that "off" attaches nothing and leaves no option behind.
B.traceSignals({ origin: true, listeners: true })
const $x = B.signal(1, 'x')
const $cx = B.$C(() => 1, 'cx')
const { signalTrace } = await load('./after/src/trace.js')
const mx = signalTrace($x)
const mcx = signalTrace($cx)
B.traceSignals(false)
const $y = B.signal(1, 'y')
const names = { getter: mcx?.getter?.name, kind: mcx?.kind, depsTracked: mcx?.deps?.().tracked.length }
console.log(`\ntrace ON  -> signal meta: ${Boolean(mx)}  origin: ${mx?.origin?.text || '(none)'}  listeners: ${mx?.listeners?.size ?? 'n/a'}`)
console.log(`trace ON  -> computed meta: ${JSON.stringify(names)}`)
console.log(`trace OFF -> meta attached to a new signal: ${Boolean(signalTrace($y))}`)
console.log(`properties: traced signal has ${Object.getOwnPropertySymbols($x).length} symbols, untraced ${Object.getOwnPropertySymbols($y).length}`)
