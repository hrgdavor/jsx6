/**
 * Bundle-size measurement for every direction.
 *
 * Two graphs per direction, because a fair comparison needs both answers:
 *
 *   core-only       the common facade in use (signal / $S / $F / $State / observeNow). Shows what the
 *                   adapter or backend costs *when nobody uses the new computed axis* — including
 *                   whatever the bundler can tree-shake away.
 *   with-computed   the same plus `$C` / `$CE` / `batch` (and, for the interop-only directions, an
 *                   alien `computed` used through the compat layer). Shows the full price of the
 *                   direction as a user would actually consume it.
 *
 * Reported plain, minified and gzipped. The real `apps/repl` entry is measured the same way, on top of
 * the plain sizes already reported by `d-dual-surface/app-compare.js`.
 */

import { gzipSync } from 'node:zlib'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as esbuild from 'esbuild'

const HERE = import.meta.dir
const ROOT = resolve(HERE, '..')
const TMP = join(HERE, '.results/bundles')

const CORE_ENTRY = `
import * as api from '@dir/index.js'
const $a = api.signal(0)
const $b = api.signal(1)
const $sum = api.$S(() => $a() + $b(), $a, $b)
const $filtered = api.$F(v => v * 2, $a)
const $s = api.$State({ x: 1 })
const $fromState = api.$S(() => $s.x() * 2, $s)
api.mergeValue($s, { x: 2 })
api.observeNow($sum, () => {})
api.observe($a, () => {})
globalThis.__size = [$sum(), $filtered(), $s.x(), $fromState(), api.isObservable($sum)]
`

/**
 * The `with-computed` entry is a **superset** of `core-only`: same facade usage plus the computed
 * axis. That makes the difference between the two columns mean "what the computed axis costs", and
 * keeps every direction comparable with the baseline (whose extra cost is zero by definition).
 */
const computedEntry = usages => `${CORE_ENTRY}
const out = []
${usages}
globalThis.__size2 = out
`

const COMPUTED_USAGE = {
  'b-native-computed': `out.push(api.$C(() => $a() + $b())())
out.push(api.$CE(() => $s.x() * 2, $s)())
api.batch(() => { $s.x = 3 })
api.dispose(api.$C(() => $a()))`,
  'c-alien-backend': `out.push(api.$C(() => $a() + $b())())
out.push(api.$CE(() => $s.x() * 2, $s)())
api.batch(() => { $s.x = 3 })
api.dispose(api.$C(() => $a()))`,
  'f-bridge-hybrid': `out.push(api.$C((a, b) => a + b, $a, $b)())
api.dispose({})`,
  'a-compat': `const A = api.toAlien($a)
const B = api.toAlien($b)
out.push(api.alien.computed(() => A() + B())())
api.dispose({})`,
  'e-alien-native': `const A = api.toAlien($a)
const B = api.toAlien($b)
out.push(api.$C(() => A() + B())())
out.push(api.$watch(() => A())())`,
  baseline: `out.push('no computed primitive in this direction')`,
}

const bundle = async (entryCode, dir, minify) => {
  const source = entryCode.replaceAll('@dir', dir.replaceAll('\\', '/'))
  const outfile = join(TMP, `${dir.split(/[\\/]/).pop()}-${minify ? 'min' : 'plain'}.js`)
  writeFileSync(outfile + '.entry.js', source, 'utf8')
  await esbuild.build({
    entryPoints: [outfile + '.entry.js'],
    bundle: true,
    format: 'esm',
    target: 'esnext',
    minify,
    write: true,
    outfile,
    logLevel: 'error',
    absWorkingDir: ROOT,
  })
  const bytes = readFileSync(outfile)
  return { plainBytes: bytes.length, gzipBytes: gzipSync(bytes).length }
}

/**
 * @param {string[]} ids direction ids (plus `baseline`)
 * @returns {Promise<Array<object>>}
 */
export async function measureSizes(ids) {
  mkdirSync(TMP, { recursive: true })
  const rows = []
  for (const id of ids) {
    const dir = join(ROOT, id)
    const corePlain = await bundle(CORE_ENTRY, dir, false)
    const coreMin = await bundle(CORE_ENTRY, dir, true)
    const usage = COMPUTED_USAGE[id]
    let computed = null
    if (usage) {
      const code = computedEntry(usage)
      const plain = await bundle(code, dir, false)
      const min = await bundle(code, dir, true)
      computed = { plainBytes: plain.plainBytes, minBytes: min.plainBytes, gzipBytes: min.gzipBytes }
    }
    rows.push({
      id,
      core: { plainBytes: corePlain.plainBytes, minBytes: coreMin.plainBytes, gzipBytes: coreMin.gzipBytes },
      computed,
      computedUsage: usage || null,
    })
  }
  return rows
}

/** The vendored alien-signals library on its own, for reference. */
export async function measureAlienBaseline() {
  mkdirSync(TMP, { recursive: true })
  const entry = `
import { signal, computed, effect, effectScope, trigger, startBatch, endBatch, setActiveSub, getActiveSub } from '${join(ROOT, 'vendor/alien-signals/index.mjs').replaceAll('\\', '/')}'
const a = signal(1)
const c = computed(() => a() * 2)
const stop = effect(() => { c(); return undefined })
startBatch(); a(2); endBatch()
trigger(() => a())
setActiveSub(getActiveSub())
effectScope(() => {})
stop()
globalThis.__alien = c()
`
  const plain = await bundle(entry, join(ROOT, 'vendor'), false)
  const min = await bundle(entry, join(ROOT, 'vendor'), true)
  return { plainBytes: plain.plainBytes, minBytes: min.plainBytes, gzipBytes: min.gzipBytes }
}

/** The real app entry, plain/min/gzip, for the backends that can run it. */
export async function measureAppEntries(ids) {
  const rows = []
  for (const id of ids) {
    const outDir = join(ROOT, 'd-dual-surface/.tmp/app-build', id)
    const file = join(outDir, 'index.js')
    try {
      const plain = readFileSync(file)
      // Re-minify the built app bundle to get a like-for-like minified figure.
      const min = await esbuild.transform(plain.toString(), { minify: true, target: 'esnext', loader: 'js' })
      const minBytes = Buffer.byteLength(min.code)
      rows.push({
        id,
        plainBytes: plain.length,
        minBytes,
        gzipBytes: gzipSync(min.code).length,
        gzipPlainBytes: gzipSync(plain).length,
      })
    } catch {
      rows.push({ id, missing: true })
    }
  }
  return rows
}