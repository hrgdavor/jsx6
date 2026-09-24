#!/usr/bin/env bun
/**
 * Run the frozen contract against one or more directions.
 *
 *   bun experiments/signal-directions/harness/run.js baseline
 *   bun experiments/signal-directions/harness/run.js baseline a-compat b-native-computed
 *
 * With no arguments it runs every directory that has an `index.js` and a `meta` export.
 */

import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import { formatResults, runDirection } from './run.js'

const HERE = import.meta.dir
const ROOT = join(HERE, '..')

const hasEntry = dir => {
  try {
    return statSync(join(ROOT, dir, 'index.js')).isFile()
  } catch {
    return false
  }
}

const known = readdirSync(ROOT, { withFileTypes: true })
  .filter(e => e.isDirectory() && !e.name.startsWith('_') && e.name !== 'harness' && e.name !== 'vendor')
  .map(e => e.name)
  .filter(hasEntry)

const requested = process.argv.slice(2)
const ids = requested.length ? requested : known
const only = []

let failures = 0
for (const id of ids) {
  const target = hasEntry(id) ? `../${id}/index.js` : id
  try {
    const result = await runDirection(target, { only: only.length ? only : undefined })
    console.log(formatResults(result))
    console.log('')
    failures += result.failed
  } catch (e) {
    console.log(`${id} — COULD NOT LOAD: ${e && e.message}`)
    console.log('')
    failures++
  }
}

console.log(failures ? `FAILURES: ${failures}` : `all contract cases passed`)
process.exit(failures ? 1 : 0)
