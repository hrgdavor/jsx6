/**
 * One-off profiler for the `unkeyed` benchmark case: where does the time go?
 * Not part of the gate.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { h } from '@jsx6/jsx6'

import { Loop2 } from '../src/Loop2.js'

GlobalRegistrator.register()

const ROWS = 10_000
const Item = ({ value }) => h('B', null, value().x)
const makeRows = n => Array.from({ length: n }, (_, i) => ({ id: i, kind: i % 3 === 0 ? 'h' : 'r', x: i }))
const rotate = (rows, step) => rows.map((_, i) => rows[(i + step) % rows.length])

const run = mode => {
  const counts = {}
  const container = document.createElement('DIV')
  const loop = new Loop2({
    item: Item,
    ...(mode === 'typed' ? { typeBy: row => row.kind } : {}),
    maxPooled: 64,
  })
  for (const key of [
    '_keyOf',
    '_typeOf',
    '_bindItem',
    '_stampIndex',
    '_setItemType',
    '_takeFree',
    'makeItem',
    '_finishPass',
    '_fixItemList',
    '_poolsOf',
  ]) {
    const original = loop[key]
    loop[key] = function (...args) {
      counts[key] = (counts[key] || 0) + 1
      return original.apply(this, args)
    }
  }
  container.appendChild(loop.el)
  const rows = makeRows(ROWS)
  loop.setValue(rows)
  for (const k of Object.keys(counts)) delete counts[k]
  const t0 = performance.now()
  for (let s = 1; s <= 5; s++) loop.setValue(rotate(rows, s))
  const ms = performance.now() - t0
  console.log(`\n${mode}: ${ms.toFixed(1)}ms   owned=${loop._owned.size} count=${loop.count}`)
  for (const [name, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name.padEnd(16)} ${String(n).padStart(9)}`)
  }
}

run('untyped')
run('typed')
