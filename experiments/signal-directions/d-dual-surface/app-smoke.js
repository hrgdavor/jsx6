#!/usr/bin/env bun
/**
 * DIRECTION D, part 3 — run a **built app bundle** headlessly and assert what it rendered.
 *
 * This is the end-to-end check the harness needed: not the facade, not a microbench, but the real
 * `apps/repl` entry compiled against a candidate signal core, booted in a DOM, and interrogated about
 * what actually appeared on the page — including the two asynchronous paths (`Loop` re-render after a
 * `setTimeout`, and a Promise used directly as a JSX child).
 *
 * Runs in its own process (like `bench-one.js`): happy-dom registers global state, the app registers
 * custom elements, and neither survives mixing two bundles in one process.
 *
 *   bun app-smoke.js <appDir> <outFile>
 */

import { writeFileSync } from 'fs'
import { pathToFileURL } from 'url'
import { join } from 'path'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

const appDir = process.argv[2]
const outFile = process.argv[3]
if (!appDir) {
  console.error('usage: app-smoke.js <appDir> [outFile]')
  process.exit(2)
}

const errors = []
const warnings = []
const logs = []
const realError = console.error
const realWarn = console.warn
const realLog = console.log
// The app logs its whole scope object on boot (megabytes of DOM dump). Capture logs instead of
// printing them, so the smoke output stays readable and the JSON stays small.
console.error = (...args) => {
  errors.push(args.map(String).join(' '))
}
console.warn = (...args) => {
  warnings.push(args.map(String).join(' '))
}
console.log = (...args) => {
  if (logs.length < 200) logs.push(args.map(String).join(' ').slice(0, 200))
}

const wait = ms => new Promise(r => setTimeout(r, ms))
const bodyText = () => globalThis.document.body.textContent || ''

GlobalRegistrator.register()

const checks = []
const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail })

let bootMs = 0
let bootError = null
try {
  const t0 = performance.now()
  await import(pathToFileURL(join(appDir, 'index.js')).href)
  bootMs = performance.now() - t0
} catch (e) {
  bootError = (e && e.stack) || String(e)
}

check('bundle boots without throwing', !bootError, bootError || '')

if (!bootError) {
  // Synchronous render, driven by the app's own top-level code.
  check('renders static children', bodyText().includes('Hello world.'), bodyText().slice(0, 200))
  check('renders a Jsx6 component', bodyText().includes('AComponent:'), '')
  check('renders a function component', bodyText().includes('Bla'), '')
  check('loop items were set via the scope (p attribute)', bodyText().includes('jozo') && bodyText().includes('mirko'), '')

  const scope = globalThis.window.APP
  check('scope captured editor parts', !!(scope && scope.editor && scope.editor3), Object.keys(scope || {}).join(','))

  // `x-value` two-way binding and a plain signal child, through the core being tested.
  const inputs = [...globalThis.document.querySelectorAll('input')]
  check('x-value inputs rendered', inputs.length >= 2, `${inputs.length} inputs`)

  // Reactive update #1: a signal write must reach the DOM synchronously.
  if (globalThis.window.testState) {
    const before = globalThis.document.querySelectorAll('[hidden]').length
    globalThis.window.testState(false)
    const after = globalThis.document.querySelectorAll('[hidden]').length
    check('x-if reacts to a signal write', after > before, `${before} → ${after} hidden elements`)
  } else {
    check('x-if reacts to a signal write', false, 'window.testState missing')
  }

  // Reactive update #2 (async): the app re-renders a Loop 1s after boot via setTimeout.
  await wait(1400)
  check('Loop re-renders after an async signal write', bodyText().includes('boink'), '')

  // Reactive update #3 (async): a Promise used directly as a JSX child (K4 interop).
  await wait(900)
  check('a Promise used as a JSX child resolves into the DOM', bodyText().includes('promise_done'), '')
}

const result = {
  appDir,
  bootMs,
  bootError,
  checks,
  passed: checks.filter(c => c.pass).length,
  failed: checks.filter(c => !c.pass).length,
  errors,
  warnings: warnings.slice(0, 10),
  logCount: logs.length,
  bodySnippet: bodyText().replace(/\s+/g, ' ').slice(0, 300),
}

GlobalRegistrator.unregister()
console.error = realError
console.warn = realWarn
console.log = realLog

if (outFile) writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8')
console.log(
  `${appDir.split(/[\\/]/).slice(-1)[0]}: ${result.passed} pass / ${result.failed} fail · boot ${bootMs.toFixed(0)} ms · ` +
    `${logs.length} app log lines` +
    (errors.length ? ` · ${errors.length} console.error` : ''),
)
for (const c of checks) if (!c.pass) console.log(`  ✗ ${c.name} ${c.detail}`.trim())
for (const e of errors.slice(0, 3)) console.log(`  ! ${e.slice(0, 200)}`)
process.exit(result.failed ? 1 : 0)