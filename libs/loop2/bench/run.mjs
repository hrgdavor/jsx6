/**
 * Benchmark runner: every case in its own process, so JIT state from one case cannot flatter another.
 * Prints `case untypedMs typedMs delta%` and a summary line.
 *
 * Usage: bun bench/run.mjs [caseName]
 */
import { spawnSync } from 'node:child_process'

const CASES = ['build', 'rotate1k', 'window', 'unkeyed', 'unkeyedRetyped', 'push', 'shrink']
const [, , only] = process.argv
const cases = only ? [only] : CASES

const runOne = spec => {
  const res = spawnSync('bun', ['bench/list.bench.mjs', spec], {
    encoding: 'utf8',
    cwd: import.meta.dir + '/..',
  })
  if (res.status !== 0) throw new Error(`bench ${spec} failed:\n${res.stderr || res.stdout}`)
  return Number(res.stdout.trim().split('\t')[1])
}

console.log('case'.padEnd(10), 'untyped'.padStart(9), 'typed'.padStart(9), 'delta'.padStart(8))
for (const name of cases) {
  const untyped = runOne(`${name}:untyped`)
  const typed = runOne(`${name}:typed`)
  const delta = untyped === 0 ? 0 : ((typed - untyped) / untyped) * 100
  console.log(
    name.padEnd(10),
    untyped.toFixed(3).padStart(9),
    typed.toFixed(3).padStart(9),
    `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`.padStart(8),
  )
}
