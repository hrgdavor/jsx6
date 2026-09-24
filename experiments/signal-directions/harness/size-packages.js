#!/usr/bin/env bun
/**
 * Bundle-size breakdown for the **shipped** packages, which is what C's README documents.
 *
 * Answers three different questions with the same entry shape:
 *   - total:     what an app pays for each core, plain / minified / gzipped
 *   - attribution: how much of C's total is alien-signals itself versus jsx6-side code
 *   - delta:     C's total compared with B's (the other shipped core)
 *
 *   bun experiments/signal-directions/harness/size-packages.js
 */

import { gzipSync } from 'node:zlib'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as esbuild from 'esbuild'

const HERE = import.meta.dir
const DIRS = resolve(HERE, '..')
const ROOT = resolve(DIRS, '../..')
const TMP = join(HERE, '.results/packages')
mkdirSync(TMP, { recursive: true })

const CORE_USE = `
const $a = api.signal(0)
const $b = api.signal(1)
const $sum = api.$S(() => $a() + $b(), $a, $b)
const $filtered = api.$F(v => v * 2, $a)
const $s = api.$State({ x: 1 })
const $fromState = api.$S(() => $s.x() * 2, $s)
api.mergeValue($s, { x: 2 })
api.observeNow($sum, () => {})
api.observe($a, () => {})
const out = [$sum(), $filtered(), $s.x(), $fromState()]
`

const COMPUTED_USE = `
out.push(api.$C(() => $a() + $b())())
out.push(api.$CE(() => $s.x() * 2, $s)())
api.batch(() => { $s.x = 3 })
api.dispose(api.$C(() => $a()))
`

const ALIEN_USE = `
const a = alien.signal(1)
const c = alien.computed(() => a() * 2)
const stop = alien.effect(() => { c(); return undefined })
alien.startBatch()
a(2)
alien.endBatch()
alien.trigger(() => a())
alien.effectScope(() => {})
stop()
globalThis.__alien = c()
`

const build = async (name, source, minify) => {
  const entry = join(TMP, `${name}.entry.js`)
  const outfile = join(TMP, `${name}${minify ? '.min' : ''}.js`)
  writeFileSync(entry, source, 'utf8')
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    target: 'esnext',
    minify,
    outfile,
    absWorkingDir: ROOT,
    logLevel: 'error',
  })
  const bytes = readFileSync(outfile)
  return { bytes: bytes.length, gzip: gzipSync(bytes).length }
}

const measure = async (name, source) => {
  const plain = await build(name, source, false)
  const min = await build(name, source, true)
  return { plain: plain.bytes, min: min.bytes, gzip: min.gzip }
}

const entryFor = (spec, use) => `import * as api from '${spec}'\n${CORE_USE}\n${use}\n`
/** Absolute Windows paths need forward slashes inside an import specifier. */
const asSpec = p => p.replaceAll('\\', '/')

const results = {}
results.control = await measure('control-1.8.18', entryFor(asSpec(join(DIRS, 'baseline/signal/index.js')), ''))
results.b = await measure('signal-b', entryFor(asSpec(join(ROOT, 'libs/signal/index.js')), COMPUTED_USE))
results.c = await measure('signal-alien-c', entryFor(asSpec(join(ROOT, 'libs/signal-alien/index.js')), COMPUTED_USE))
results.alien = await measure('alien-alone', `import * as alien from 'alien-signals'\n${ALIEN_USE}`)
results.alienOnlyComputed = await measure(
  'alien-computed-only',
  `import { signal, computed, effect } from 'alien-signals'
const a = signal(1)
const c = computed(() => a() * 2)
const stop = effect(() => { c(); return undefined })
stop()
globalThis.__x = c()`,
)

const kb = n => (n / 1024).toFixed(1)
const row = (label, r) => `| ${label} | ${kb(r.plain)} kB | ${kb(r.min)} kB | **${kb(r.gzip)} kB** |`

console.log('| bundle | plain | minified | gzipped |')
console.log('|---|---|---|---|')
console.log(row('`@jsx6/signal` (B) — core + computed axis', results.b))
console.log(row('`@jsx6/signal-alien` (C) — total', results.c))
console.log(row('alien-signals alone (full API surface)', results.alien))
console.log(row('alien-signals, just `signal`+`computed`+`effect`', results.alienOnlyComputed))
console.log(row('frozen 1.8.18 core (control, no computed)', results.control))
console.log('')
console.log(`C total                ${kb(results.c.gzip)} kB gzip`)
console.log(`  of which alien       ${kb(results.alien.gzip)} kB gzip (full surface; ${kb(results.alienOnlyComputed.gzip)} kB for signal+computed+effect)`)
console.log(`  of which jsx6-side   ${kb(results.c.gzip - results.alien.gzip)} kB gzip (estimated by difference)`)
console.log(`B total                ${kb(results.b.gzip)} kB gzip`)
console.log(`C minus B (gzip)       +${kb(results.c.gzip - results.b.gzip)} kB  (${(((results.c.gzip - results.b.gzip) / results.b.gzip) * 100).toFixed(0)}%)`)
console.log(`C minus B (minified)   +${kb(results.c.min - results.b.min)} kB`)
console.log(`control -> B (gzip)    +${kb(results.b.gzip - results.control.gzip)} kB`)