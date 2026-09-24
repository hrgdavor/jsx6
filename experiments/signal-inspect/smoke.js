#!/usr/bin/env bun
/**
 * Headless check of the demo page: build it, boot the **bundle** in a DOM, and assert that everything
 * the page promises the console actually holds.
 *
 * This is not a test of the library (the packages have their own suites) — it is the check that the
 * demo page is not lying: the globals exist, the table really is reactive, the `value` getter is a
 * non-enumerable getter, the snapshot-vs-signal distinction is real, and both cores behave the same.
 *
 *   bun experiments/signal-inspect/smoke.js
 */

import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { readFileSync } from 'fs'
import { pathToFileURL } from 'url'
import { join } from 'path'
import { build } from './serve.js'

const HERE = import.meta.dir

const errors = []
const logs = []
const realError = console.error
const realLog = console.log
console.error = (...a) => errors.push(a.map(String).join(' '))
console.log = (...a) => logs.push(a.map(String).join(' ').slice(0, 160))

GlobalRegistrator.register({ url: 'http://127.0.0.1/' })

// Load the real page markup first: the bundle queries these elements on load, so this also checks that
// index.html and demo-src.js agree on every id the demo needs.
const html = readFileSync(join(HERE, 'index.html'), 'utf8')
const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1]
if (!body) throw new Error('index.html has no <body>')
// Drop the tags that would make happy-dom try to fetch anything: the bundle is imported explicitly
// below, and a `<script src>` here would only produce a network error.
document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/gi, '')

const bundle = await build()
await import(pathToFileURL(bundle).href)

// The page logs itself; give it a tick, then interrogate the globals it created.
await new Promise(r => setTimeout(r, 50))

const checks = []
const check = (name, fn) => {
  try {
    const detail = fn()
    checks.push({ name, ok: true, detail: detail === undefined ? '' : String(detail) })
  } catch (e) {
    checks.push({ name, ok: false, detail: (e && e.message) || String(e) })
  }
}

const assert = (cond, message) => {
  if (!cond) throw new Error(message)
}

/** The rendered value cell of a table row, found by the signal name in its first cell. */
const cellOf = name => {
  for (const tr of document.querySelectorAll('#values tbody tr')) {
    if (tr.children[0].textContent === name) return tr.children[2].textContent
  }
  return undefined
}

const w = globalThis.window
check('globals exist', () => {
  for (const name of ['core', 'cores', 'signals', 'demo', '$count', '$double', '$eager', '$sum', '$user', '$static', '$duck']) {
    assert(w[name] !== undefined || name === 'null', `window.${name} is missing`)
  }
  return Object.keys(w.signals).join(' ')
})

check('value getter on a signal', () => {
  assert(w.$count.value === 1, `$count.value is ${w.$count.value}`)
  const d = Object.getOwnPropertyDescriptor(w.$count, 'value')
  assert(typeof d.get === 'function', 'value is not a getter')
  assert(d.enumerable === false, 'value is enumerable')
  assert(d.set === undefined, 'value has a setter')
  return 'getter, non-enumerable, read-only'
})

check('value getter on both computed flavours', () => {
  assert(w.$double.value === 2, `$double.value is ${w.$double.value}`)
  assert(w.$eager.value === 10, `$eager.value is ${w.$eager.value}`)
  return `$double=${w.$double.value} $eager=${w.$eager.value}`
})

check('the live table is reactive', () => {
  const rows = document.querySelectorAll('#values tbody tr').length
  const before = cellOf('$count')
  w.$count(42)
  const after = cellOf('$count')
  assert(rows === 10, `expected 10 rows, got ${rows}`)
  assert(before === '1', `$count row rendered ${before} before the write`)
  assert(after === '42', `$count row rendered ${after} after the write`)
  return `${rows} rows, $count ${before} -> ${after}`
})

check('union dependencies: the omitted $base still invalidates', () => {
  w.$base(500)
  assert(w.$sum.value === 542, `$sum.value is ${w.$sum.value}, expected 542`)
  return '$base omitted from the declared list, tracked anyway'
})

check('snapshot vs signal: the object stays live, the call does not', () => {
  const snapshot = w.$count()
  const live = w.$count
  w.$count(7)
  assert(snapshot === 42, `snapshot changed to ${snapshot}`)
  assert(live.value === 7, `live value is ${live.value}`)
  return 'snapshot 42 (frozen), signal 7 (current)'
})

check('$State is a proxy: child has the getter, the proxy does not', () => {
  assert(w.$user.name.value === 'Ada', `child value is ${w.$user.name.value}`)
  assert(!('value' in w.$user) || typeof w.$user.value === 'function', '$user.value is not a child signal')
  assert(JSON.stringify(w.$user()) === '{"name":"Ada","age":36}', `snapshot is ${JSON.stringify(w.$user())}`)
  return `child=${w.$user.name.value} snapshot=${JSON.stringify(w.$user())}`
})

check('staticSignal and duck-typed signals have no value getter', () => {
  assert(!('value' in w.$static), 'staticSignal has a value property')
  assert(!('value' in w.$duck), 'duck-typed signal has a value property')
  assert(w.$static() === 3 && w.$duck() === 'standard', 'their reads are broken')
  return 'no value on either, reads fine'
})

check('a cyclic computed reports once and returns the previous value', () => {
  w.$count(1)
  let $cyclic
  const errorsBefore = errors.length
  $cyclic = w.core.$C(() => ($cyclic ? $cyclic() : 0) + 1)
  const first = $cyclic.value
  const second = $cyclic.value
  assert(Number.isNaN(first) && Number.isNaN(second), `expected NaN, got ${first}/${second}`)
  const reports = errors.length - errorsBefore
  assert(reports === 1, `expected 1 cycle report, got ${reports}`)
  return `NaN, ${reports} report`
})

check('switching cores keeps the same contract', () => {
  w.demo.activate('alien')
  assert(w.core.alien !== undefined, 'alien core has no interop surface')
  assert(w.$count.value === 1, `alien $count.value is ${w.$count.value}`)
  const d = Object.getOwnPropertyDescriptor(w.$count, 'value')
  assert(typeof d.get === 'function' && d.enumerable === false, 'alien value getter differs')
  w.$count(3)
  assert(w.$double.value === 6, `alien $double.value is ${w.$double.value}`)
  assert(cellOf('$count') === '3', `alien table rendered ${cellOf('$count')}`)
  w.demo.activate('signal')
  return 'alien core: getter, reactivity and table all identical'
})

// ------------------------------------------------------------------------------------------------
// console interception — the mechanism the page actually uses
// ------------------------------------------------------------------------------------------------


check('the page installs console inspection', () => {
  assert(w.demo.hasConsoleInspection(), 'console interception is not installed')
  // The library's installer is what makes `console.log($sig)` show a value with no call-site change.
  const described = w.demo.describe(w.$count)
  assert(described.value === w.$count(), `describe gave ${described.value} for ${w.$count()}`)
  assert(described.raw === w.$count, 'the raw signal is not reachable from the description')
  assert(Object.keys(described).join() === 'signal,kind,value,read,raw', Object.keys(described).join())
  const wrapper = w.console.log
  assert(typeof wrapper.original === 'function', 'the original console.log is not kept')
  return 'installed, describe() shape correct, original kept'
})
console.error = realError
console.log = realLog

const failed = checks.filter(c => !c.ok)
console.log('=== signal-inspect demo smoke ===')
for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name.padEnd(52)} ${c.detail}`)
console.log(`\n${checks.length - failed.length} pass / ${failed.length} fail`)
console.log(`console output while loading: ${logs.length} line(s), ${errors.length} error(s)`)
if (errors.length) console.log(`  first error: ${errors[0].slice(0, 120)}`)
process.exit(failed.length ? 1 : 0)
