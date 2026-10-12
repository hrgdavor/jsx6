/**
 * Loop2 micro-benchmarks — a Bun script, not a test (the name has no `*.test.*`, so the gate ignores
 * it; `bench/` is not published either).
 *
 * The question it answers: **what does the type axis cost when a list never uses it?** Every case runs
 * in its own process (`run.mjs`, or pass a case name here) so one case's JIT state cannot flatter
 * another; each timing is the median of several runs after one warm-up run.
 *
 * Real DOM, detached: the loop's anchor is appended to a detached container, so `insertBefore` and
 * `removeChild` are real DOM calls but no layout or paint happens (that would measure happy-dom, not
 * the loop). The item template is trivial on purpose.
 *
 * Usage:
 *   bun bench/run.mjs                 # every case, both modes, medians
 *   bun bench/list.bench.mjs build:typed
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { h } from '@jsx6/jsx6'

import { Loop2 } from '../src/Loop2.js'

GlobalRegistrator.register()

const ROWS = 10_000
const WINDOW = 20
const Item = ({ value }) => h('B', null, value().x)

const makeRows = n => Array.from({ length: n }, (_, i) => ({ id: i, kind: i % 3 === 0 ? 'h' : 'r', x: i }))

/** median of `runs` timings in ms, after one untimed warm-up */
const timeIt = (runs, fn) => {
  fn()
  const times = []
  for (let r = 0; r < runs; r++) {
    const t0 = performance.now()
    fn()
    times.push(performance.now() - t0)
  }
  times.sort((a, b) => a - b)
  return times[Math.floor(times.length / 2)]
}

const rotate = (rows, step) => rows.map((_, i) => rows[(i + step) % rows.length])

/** a loop whose anchor is attached to a detached container, plus that container */
const mounted = (mode, opts = {}) => {
  const container = document.createElement('DIV')
  const loop = new Loop2({
    item: Item,
    keyBy: row => row.id,
    ...(mode === 'typed' ? { typeBy: row => row.kind } : {}),
    maxPooled: 64,
    ...opts,
  })
  container.appendChild(loop.el)
  return { loop, container }
}

/** untyped list (no keyBy at all) — the index path */
const mountedUnkeyed = mode => {
  const container = document.createElement('DIV')
  const loop = new Loop2({
    item: Item,
    ...(mode === 'typed' ? { typeBy: row => row.kind } : {}),
    maxPooled: 64,
  })
  container.appendChild(loop.el)
  return { loop, container }
}

const cases = {
  /** build a 10 000-row list from scratch */
  build: mode => {
    const { loop } = mounted(mode)
    const rows = makeRows(ROWS)
    return timeIt(5, () => loop.setValue(rows))
  },
  /** reorder 1 000 keyed rows by one step, repeatedly */
  rotate1k: mode => {
    const { loop } = mounted(mode)
    const rows = makeRows(1_000)
    loop.setValue(rows)
    return timeIt(20, () => {
      for (let s = 1; s <= 10; s++) loop.setValue(rotate(rows, s))
    })
  },
  /** scroll a 20-row window 400 times over a 10 000-row list */
  window: mode => {
    const { loop } = mounted(mode, { maxPooled: WINDOW + 2 })
    const rows = makeRows(ROWS)
    return timeIt(10, () => {
      for (let top = 0; top < 400; top++) loop.setWindow(rows.slice(top, top + WINDOW), top)
    })
  },
  /** unkeyed: values swap in place, 10 000 rows (the same kinds land on the same positions) */
  unkeyed: mode => {
    const { loop } = mountedUnkeyed(mode)
    const rows = makeRows(ROWS)
    loop.setValue(rows)
    return timeIt(10, () => {
      for (let s = 1; s <= 5; s++) loop.setValue(rotate(rows, s * 3))
    })
  },
  /**
   * the same unkeyed list, but each rotation moves the *kinds* to different positions. A typed loop
   * must build a fresh item for a position whose type changed — that is the feature working, not
   * overhead — so this case is expected to be slower for `typed` and is here to keep the number honest.
   */
  unkeyedRetyped: mode => {
    const { loop } = mountedUnkeyed(mode)
    const rows = makeRows(ROWS)
    loop.setValue(rows)
    return timeIt(10, () => {
      for (let s = 1; s <= 5; s++) loop.setValue(rotate(rows, s))
    })
  },
  /** 1 000 pushes onto an existing list (the loop is rebuilt per run, which is not timed) */
  push: mode => {
    const grow = () => {
      const { loop } = mounted(mode)
      loop.setValue(makeRows(1_000))
      const t0 = performance.now()
      for (let i = 0; i < 1_000; i++) loop.push({ id: 100_000 + i, kind: 'r', x: i })
      return performance.now() - t0
    }
    grow() // warm-up, untimed
    const times = Array.from({ length: 10 }, grow).sort((a, b) => a - b)
    return times[5]
  },
  /** shrink 10 000 rows to 100 (parks 9 900, trims to maxPooled) */
  shrink: mode => {
    const { loop } = mounted(mode, { maxPooled: 100 })
    const rows = makeRows(ROWS)
    loop.setValue(rows)
    return timeIt(5, () => loop.setValue(rows.slice(0, 100)))
  },
}

const spec = process.argv[2]
const wanted = spec ? [spec] : Object.keys(cases).flatMap(name => [`${name}:untyped`, `${name}:typed`])
for (const entry of wanted) {
  const [name, mode] = entry.split(':')
  console.log(`${entry}\t${cases[name](mode).toFixed(3)}`)
}
