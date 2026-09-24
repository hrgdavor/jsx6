/**
 * Micro + macro benchmarks, run identically against every direction.
 *
 * Rules that make the numbers comparable:
 *   - every bench is expressed **only** through the frozen facade (`contract.md`), so no direction
 *     gets a cheaper code path than another;
 *   - medians of several runs, with a warm-up run that is discarded;
 *   - a `sink` accumulator so nothing can be optimised away;
 *   - capability-gated benches (computed, batch) are reported as `n/a` rather than silently skipped,
 *     because "no computed primitive" is a result.
 *
 * The macro bench is the one that matters for this project: it simulates **long-lived components**
 * (mount many, write often, unmount and release), which is the workload the library is built for.
 */

import { heapStats } from 'bun:jsc'
import { median } from './stats.js'

export const N = {
  writeRead: 2_000_000,
  fanoutListeners: 100,
  fanoutWrites: 20_000,
  chainWrites: 50_000,
  diamondWrites: 50_000,
  computedWrites: 50_000,
  churn: 20_000,
  stateMerge: 20_000,
  components: 300,
  componentWrites: 10,
}

/**
 * Heap measurement.
 *
 * `process.memoryUsage().heapUsed` is *not* responsive in Bun (measured: it reports the same number
 * across a 100k-object allocation, while `bun:jsc`'s `heapStats()` moves by the expected amount), so
 * the JSC statistics are used. The results table therefore reports JSC heap size.
 */
const heapUsedKb = () => {
  Bun.gc(true)
  return Math.round(heapStats().heapSize / 1024)
}

const timeOnce = fn => {
  const t0 = performance.now()
  const value = fn()
  return { ms: performance.now() - t0, value }
}

const timeMedian = (fn, runs = 5) => {
  fn() // warm-up, discarded
  const samples = []
  for (let i = 0; i < runs; i++) samples.push(timeOnce(fn).ms)
  return median(samples)
}

/**
 * @param {any} api a loaded direction module
 * @returns {Promise<Record<string, number|null>>} milliseconds per bench (null = not applicable)
 */
export async function benchDirection(api) {
  const caps = new Set(api.meta?.capabilities || ['core'])
  const out = {}

  // b1 — the hot path: write then read a plain signal.
  {
    const $a = api.signal(0)
    out.writeRead = timeMedian(() => {
      let sink = 0
      for (let i = 0; i < N.writeRead; i++) {
        $a(i)
        sink += $a()
      }
      return sink
    })
  }

  // b2 — fan-out: many observers on one source (notification cost).
  {
    const $a = api.signal(0)
    const stoppers = []
    for (let i = 0; i < N.fanoutListeners; i++) stoppers.push(api.observe($a, () => {}))
    out.fanout = timeMedian(() => {
      for (let i = 0; i < N.fanoutWrites; i++) $a(i)
    })
    stoppers.forEach(un => un?.())
  }

  // b3 — a 4-deep derived chain, eager (the shape long-lived components use).
  {
    const $a = api.signal(0)
    const $b = api.$S(() => $a() + 1, $a)
    const $c = api.$S(() => $b() + 1, $b)
    const $d = api.$S(() => $c() + 1, $c)
    const un = api.observe($d, () => {})
    out.chain = timeMedian(() => {
      for (let i = 0; i < N.chainWrites; i++) $a(i)
      return $d()
    })
    un?.()
  }

  // b4 — diamond: two derived from one source, joined.  This is where glitches and wasted
  // recomputations show up.
  {
    const $s = api.signal(0)
    const $a = api.$S(() => $s() * 2, $s)
    const $b = api.$S(() => $s() * 3, $s)
    const $sum = api.$S(() => $a() + $b(), $a, $b)
    const un = api.observe($sum, () => {})
    out.diamond = timeMedian(() => {
      for (let i = 0; i < N.diamondWrites; i++) $s(i)
      return $sum()
    })
    un?.()
  }

  // b5 — computed read (lazy for `$C`; only where the direction has one).
  if (caps.has('computed')) {
    const $s = api.signal(0)
    const $c = api.$C(() => $s() * 2, $s)
    out.computed = timeMedian(() => {
      let sink = 0
      for (let i = 0; i < N.computedWrites; i++) {
        $s(i)
        sink += $c()
      }
      return sink
    })
  } else {
    out.computed = null
  }

  // b6 — subscribe/unsubscribe churn on a fresh signal each time (binding lifecycle cost).
  {
    out.churn = timeMedian(() => {
      for (let i = 0; i < N.churn; i++) {
        const $v = api.signal(i)
        const un = api.observeNow($v, () => {})
        $v(i + 1)
        un?.()
      }
    })
  }

  // b7 — `$State` merge with a derived observer (aggregate batching path).
  {
    const $s = api.$State({ a: 1, b: 2, c: 3 })
    const $sum = api.$S(() => $s.a() + $s.b() + $s.c(), $s)
    const un = api.observe($sum, () => {})
    out.stateMerge = timeMedian(() => {
      for (let i = 0; i < N.stateMerge; i++) api.mergeValue($s, { a: i, b: i, c: i })
      return $sum()
    })
    un?.()
  }

  // b8 — explicit batch of two writes with a derived observer (glitch-free path).
  if (caps.has('batch:core') || caps.has('batch')) {
    const $s = api.$State({ x: 1, y: 1 })
    const $sum = api.$S(() => $s.x() + $s.y(), $s)
    const un = api.observe($sum, () => {})
    out.batch = timeMedian(() => {
      for (let i = 0; i < N.stateMerge / 2; i++)
        api.batch(() => {
          $s.x = i
          $s.y = i
        })
      return $sum()
    })
    un?.()
  } else {
    out.batch = null
  }

  return out
}

/**
 * The long-lived-component macro bench. Uses only core API so every direction can run it.
 *
 * @param {any} api
 * @param {{ register: () => void, unregister: () => void }} dom happy-dom registrator callbacks
 */
export async function benchLongLived(api, dom) {
  dom.register()
  try {
    const doc = globalThis.document
    const rows = N.components
    const nodes = []
    const stoppers = []
    const signals = []
    const states = []

    const heapBefore = heapUsedKb()
    const mount = timeOnce(() => {
      for (let i = 0; i < rows; i++) {
        const el = doc.createElement('div')
        doc.body.appendChild(el)
        const $v = api.signal(i)
        const $s = api.$State({ n: i, label: `row${i}` })
        const $derived = api.$S(() => `${$s.label()}:${$s.n() * 2}`, $s)
        stoppers.push(api.observeNow($derived, v => (el.textContent = v)))
        stoppers.push(api.observeNow($v, v => el.setAttribute('data-v', v)))
        nodes.push(el)
        signals.push($v)
        states.push($s)
      }
    })
    const heapMounted = heapUsedKb()

    const update = timeOnce(() => {
      for (let round = 0; round < N.componentWrites; round++) {
        for (let i = 0; i < rows; i++) {
          signals[i](round)
          if (i % 3 === 0) states[i].n = round
        }
      }
    })

    // Release everything the way the runtime does: the stored unsubscribe functions.
    const unmount = timeOnce(() => {
      for (const un of stoppers) un?.()
      for (const el of nodes) el.remove()
      nodes.length = 0
      signals.length = 0
      states.length = 0
      stoppers.length = 0
    })
    const heapAfter = heapUsedKb()

    return {
      mountMs: mount.ms,
      updateMs: update.ms,
      unmountMs: unmount.ms,
      mountHeapKb: heapMounted - heapBefore,
      retainedHeapKb: heapAfter - heapBefore,
      text: nodes[0]?.textContent ?? null,
    }
  } finally {
    dom.unregister()
  }
}

export { heapUsedKb, timeMedian, timeOnce }
