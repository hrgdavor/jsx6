#!/usr/bin/env bun
/**
 * Measures **one** direction in its own process and writes the result as JSON.
 *
 * Why a separate process per direction: running six implementations in one process lets the JIT and
 * the GC of earlier directions leak into later measurements (observed: the untouched baseline's
 * `write+read` moved by 22 % depending on run order, with no code difference at all). Each direction
 * therefore gets a fresh heap and a fresh JIT.
 *
 *   bun harness/bench-one.js b-native-computed .results/b-native-computed.json
 *
 * The parent (`compare.js`) spawns this with `stdio: 'inherit'` — piped stdio is not usable in every
 * environment this harness runs in — and reads the JSON file instead.
 */

import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { countLoc, runDirection } from './run.js'
import { benchDirection, benchLongLived } from './bench.js'

const HERE = import.meta.dir
const ROOT = resolve(HERE, '..')

const id = process.argv[2]
const outFile = process.argv[3] || join(HERE, '.results', `${id}.json`)
if (!id) {
  console.error('usage: bench-one.js <direction-id> [outfile]')
  process.exit(2)
}

const dom = {
  register: () => GlobalRegistrator.register(),
  unregister: () => GlobalRegistrator.unregister(),
}

const target = id.includes('/') ? id : `../${id}/index.js`
const { meta, results, passed, failed, skipped, api } = await runDirection(target)
const loc = countLoc(join(ROOT, meta.id, meta.sourceRoot || '.'))
const sharedLoc = countLoc(join(ROOT, '_shared'))
const micro = await benchDirection(api)
const macro = await benchLongLived(api, dom)

const payload = {
  id,
  meta,
  passed,
  failed,
  skipped,
  failures: results.filter(r => r.status === 'failed'),
  skips: results.filter(r => r.status === 'skipped').map(r => r.id),
  loc,
  sharedLoc,
  micro,
  macro,
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8')
console.log(
  `${id}: ${passed} pass / ${failed} fail / ${skipped} skip · loc ${loc} (+${sharedLoc} shared) · ` +
    `write+read ${micro.writeRead?.toFixed(2)} ms · 300-component updates ${macro.updateMs.toFixed(1)} ms`,
)
