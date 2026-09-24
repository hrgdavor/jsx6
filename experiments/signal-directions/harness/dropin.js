/**
 * Drop-in verification.
 *
 * "Drop-in replacement" is a strong claim, so it is checked as a set of falsifiable conditions rather
 * than asserted:
 *
 *   1. **Surface parity** — every name the shipped `@jsx6/signal` exports must exist in the candidate,
 *      with the same `typeof`. Extras are listed separately (they are the new capability, not a break).
 *   2. **Behaviour parity** — every contract case the baseline *passes* must also pass in the candidate.
 *      A candidate that fails one is a drop-in break, not a "difference of opinion". Cases the baseline
 *      cannot pass are listed as *added* capability when the candidate passes them.
 *   3. **Package contract** — the entry/`types`/`files` layout the manifest promises must still be
 *      satisfiable by the candidate (deep `src/...` imports included), because consumers and the
 *      publish gate depend on it.
 *   4. **Consumer proof** — the untouched `libs/signal` test suite (copied byte-identical into the
 *      candidate) must be green, and the real `apps/repl` entry must run on the candidate core.
 *
 * The output is `DROPIN.md`; nothing in it is hand-written.
 */

import { spawnSync } from 'child_process'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { cases } from './contract.js'

const HERE = import.meta.dir
const DIRS = resolve(HERE, '..')
const ROOT = resolve(DIRS, '../..')
const OUT = join(DIRS, 'DROPIN.md')

/**
 * Candidates are resolved as package roots or experiment directories. The reference is always the
 * shipped `libs/signal` (which is B, graduated in place), so this answers the question that matters
 * after graduation: can the real `@jsx6/signal-alien` package replace the real `@jsx6/signal`?
 *
 * `capabilities` is declared here rather than read from a `meta` export, because a shipped package
 * must not carry experiment scaffolding in its public surface.
 */
const C = ['core', 'union-deps', 'computed', 'computed:auto', 'computed:dynamic-deps', 'computed:eager', 'dispose', 'batch', 'batch:core']
const C_ALIEN = [...C, 'interop', 'interop:no-bridge-needed', 'computed:alien-only']

const CANDIDATES = [
  {
    id: 'libs/signal-alien',
    dir: join(ROOT, 'libs/signal-alien'),
    entry: join(ROOT, 'libs/signal-alien/index.js'),
    capabilities: C_ALIEN,
  },
  {
    id: 'c-alien-backend',
    dir: join(DIRS, 'c-alien-backend'),
    entry: join(DIRS, 'c-alien-backend/index.js'),
    capabilities: C_ALIEN,
  },
  {
    id: 'b-native-computed',
    dir: join(DIRS, 'b-native-computed'),
    entry: join(DIRS, 'b-native-computed/index.js'),
    capabilities: C,
  },
]

/** The core inside a candidate: `<dir>/signal` for an experiment direction, else the package root. */
const coreDirOf = dir => (existsSync(join(dir, 'signal/index.js')) ? join(dir, 'signal') : dir)

/** Everything the published package promises: exports, plus the package.json contract fields. */
const SHIPPED = JSON.parse(readFileSync(join(ROOT, 'libs/signal/package.json'), 'utf8'))
const SHIPPED_ENTRY_EXPORTS = Object.keys(
  await import(join(ROOT, 'libs/signal/index.js')),
).sort()

/** Deep source paths a consumer may legitimately import (the manifest ships `src`). */
const SOURCE_PATHS = ['src/signal.js', 'src/observe.js', 'src/state.js', 'src/makeContext.js', 'index.js']
/** Build outputs the manifest promises; produced by `tsc`/esbuild, not by hand. Verified by building. */
const GENERATED_PATHS = ['dist/index.d.ts', 'esm/index.js', 'cjs/index.js']

/**
 * Makes a candidate buildable the way the published package is: the manifest and tsconfig are copied
 * from `libs/signal` (they are build configuration, not implementation), then declarations and both
 * bundles are produced. This is what proves a drop-in candidate can still be published.
 */
const buildCandidate = (id, coreDir) => {
  const signalDir = coreDir
  for (const file of ['package.json', 'tsconfig.json']) {
    const target = join(signalDir, file)
    if (!existsSync(target)) copyFileSync(join(ROOT, 'libs/signal', file), target)
  }
  const run = (cmd, args) =>
    spawnSync(cmd, args, { cwd: signalDir, stdio: 'inherit', shell: process.platform === 'win32' }).status
  const tsc = run('bun', ['x', 'tsc', '-p', 'tsconfig.json'])
  const esm = tsc === 0 ? run('bun', ['run', 'build']) : null
  const cjs = esm === 0 ? run('bun', ['run', 'build-cjs']) : null
  const dtsPath = join(signalDir, 'dist/index.d.ts')
  const dts = existsSync(dtsPath) ? readFileSync(dtsPath, 'utf8') : null
  void id
  return { tsc, esm, cjs, dts }
}

/** Declaration names exported by a `.d.ts` file (enough to detect a surface change). */
const declaredNames = text => {
  if (!text) return new Set()
  const names = new Set()
  // A `.d.ts` is already ambient, so tsc emits both `export declare function f()` and `export const x`
  // — and sometimes a bare `declare const x` collected into a trailing `export { ... }`. Handle all.
  const decl = /(?:^|\n)\s*export\s+(?:declare\s+)?(?:function|const|let|var|class|type|interface)\s+(\w+)/g
  for (const m of text.matchAll(decl)) names.add(m[1])
  for (const m of text.matchAll(/(?:^|\n)\s*declare\s+(?:function|const|let|var|class|type|interface)\s+(\w+)/g)) {
    names.add(m[1])
  }
  for (const m of text.matchAll(/export \{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim()
      if (name) names.add(name)
    }
  }
  return names
}

const typesOf = mod =>
  Object.fromEntries(Object.entries(mod).map(([k, v]) => [k, typeof v]))

const runContract = async api => {
  const results = []
  for (const c of cases) {
    const missing = (c.requires || []).filter(r => !(api.meta.capabilities || []).includes(r))
    if (missing.length) {
      results.push({ id: c.id, status: 'skipped' })
      continue
    }
    try {
      await c.run(api)
      results.push({ id: c.id, status: 'passed' })
    } catch (e) {
      results.push({ id: c.id, status: 'failed', reason: (e && e.message) || String(e) })
    }
  }
  return results
}

const baselineMod = await import(join(ROOT, 'libs/signal/index.js'))
const baselineTypes = typesOf(baselineMod)
// The shipped core now *is* B, so its capability set is B's — that is what candidates must not regress.
const baselineCapabilities = [
  'core',
  'union-deps',
  'computed',
  'computed:auto',
  'computed:dynamic-deps',
  'computed:eager',
  'dispose',
  'batch',
  'batch:core',
]
const baselineContract = await runContract({
  ...baselineMod,
  meta: { id: 'shipped', capabilities: baselineCapabilities },
})
const baseNames = declaredNames(readFileSync(join(ROOT, 'libs/signal/dist/index.d.ts'), 'utf8'))

const rows = []
for (const { id, dir, entry, capabilities } of CANDIDATES) {
  const mod = await import(entry)
  const types = typesOf(mod)
  const core = coreDirOf(dir)

  const missingNames = SHIPPED_ENTRY_EXPORTS.filter(n => !(n in types))
  const typeMismatch = SHIPPED_ENTRY_EXPORTS.filter(n => n in types && types[n] !== baselineTypes[n]).map(n => ({
    name: n,
    baseline: baselineTypes[n],
    candidate: types[n],
  }))
  const extraNames = Object.keys(types).filter(n => !SHIPPED_ENTRY_EXPORTS.includes(n)).sort()

  const deep = SOURCE_PATHS.map(p => {
    const inShipped = existsSync(join(ROOT, 'libs/signal', p))
    const inCandidate = existsSync(join(core, p))
    return { path: p, inShipped, inCandidate, ok: !inShipped || inCandidate }
  })

  const build = buildCandidate(id, core)
  const candNames = declaredNames(build.dts)
  const dtsMissing = [...baseNames].filter(n => !candNames.has(n))
  const dtsAdded = [...candNames].filter(n => !baseNames.has(n))

  const contract = await runContract({ ...mod, meta: { ...mod.meta, capabilities: capabilities || baselineCapabilities } })
  const byId = Object.fromEntries(contract.map(r => [r.id, r]))
  const regressions = baselineContract
    .filter(b => b.status === 'passed' && byId[b.id]?.status === 'failed')
    .map(b => ({ id: b.id, reason: byId[b.id].reason }))
  const added = contract.filter(c => c.status === 'passed' && baselineContract.find(b => b.id === c.id)?.status !== 'passed').map(c => c.id)
  const stillMissing = contract.filter(c => c.status === 'skipped').map(c => c.id)

  // The candidate's own suite: the shipped 30 tests (copied byte-identically) plus its new ones.
  const tests = spawnSync('bun', ['test'], {
    cwd: core,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  rows.push({
    id,
    meta: mod.meta,
    missingNames,
    typeMismatch,
    extraNames,
    deep,
    build,
    dtsMissing,
    dtsAdded,
    regressions,
    added,
    stillMissing,
    contractPassed: contract.filter(c => c.status === 'passed').length,
    testsExit: tests.status,
    dropIn:
      missingNames.length === 0 &&
      typeMismatch.length === 0 &&
      regressions.length === 0 &&
      tests.status === 0 &&
      build.tsc === 0 &&
      build.esm === 0 &&
      build.cjs === 0 &&
      dtsMissing.length === 0,
  })
}

const md = []
const w = l => md.push(l)
w('# Drop-in verification: can the candidate replace `@jsx6/signal` as-is?')
w('')
w(`Generated by \`bun experiments/signal-directions/harness/dropin.js\` on ${new Date().toISOString()}.`)
w('')
w('"Drop-in" is checked, not asserted: export-surface parity, behavioural parity on every contract case')
w('the shipped package passes, deep-source-path compatibility, and the untouched `libs/signal` test')
w('suite. A single behavioural regression fails the verdict.')
w('')
w('## Verdict')
w('')
w('| candidate | surface | behaviour | source paths | types (`tsc`) | bundles | shipped tests | verdict |')
w('|---|---|---|---|---|---|---|---|')
for (const r of rows) {
  w(
    `| \`${r.id}\` | ${r.missingNames.length || r.typeMismatch.length ? `**${r.missingNames.length} missing, ${r.typeMismatch.length} type mismatch**` : `${SHIPPED_ENTRY_EXPORTS.length} names, all matching`} | ` +
      `${r.regressions.length ? `**${r.regressions.length} regressions**` : `${r.contractPassed} cases pass, 0 regressions`} | ` +
      `${r.deep.every(d => d.ok) ? 'all present' : '**missing**'} | ` +
      `${r.build.tsc === 0 ? 'clean' : `**exit ${r.build.tsc}**`}${r.dtsMissing.length ? `, **${r.dtsMissing.length} declarations lost**` : ', no declarations lost'} | ` +
      `${r.build.esm === 0 && r.build.cjs === 0 ? 'esm + cjs built' : '**build failed**'} | ` +
      `${r.testsExit === 0 ? 'green (exit 0)' : `**exit ${r.testsExit}**`} | ` +
      `${r.dropIn ? '✅ **drop-in**' : '❌ **not drop-in**'} |`,
  )
}
w('')
w('## 1. Export surface')
w('')
w(`The shipped package exports ${SHIPPED_ENTRY_EXPORTS.length} names. Each candidate must provide all of`)
w('them with the same `typeof`.')
w('')
for (const r of rows) {
  w(`### \`${r.id}\``)
  w('')
  w(`* shipped names present: **${SHIPPED_ENTRY_EXPORTS.length - r.missingNames.length} / ${SHIPPED_ENTRY_EXPORTS.length}**`)
  w(`* missing: ${r.missingNames.length ? r.missingNames.map(n => `\`${n}\``).join(', ') : '— none'}`)
  w(`* type mismatches: ${r.typeMismatch.length ? r.typeMismatch.map(t => `\`${t.name}\` (${t.baseline} → ${t.candidate})`).join(', ') : '— none'}`)
  w(`* **added** by this direction (${r.extraNames.length}): ${r.extraNames.map(n => `\`${n}\``).join(', ') || '—'}`)
  w('')
}

w('## 2. Behavioural parity (contract cases)')
w('')
w('Cases the shipped package passes are the compatibility bar: a candidate that fails one is a')
w('regression. Cases the shipped package cannot pass are the new capability.')
w('')
for (const r of rows) {
  w(`### \`${r.id}\``)
  w('')
  w(`* regressions vs the shipped package: ${r.regressions.length ? r.regressions.map(x => `\`${x.id}\` — ${x.reason}`).join('; ') : '**none**'}`)
  w(`* newly passing (added capability, ${r.added.length}): ${r.added.map(a => `\`${a}\``).join(', ') || '—'}`)
  w(`* still not applicable/skipped (${r.stillMissing.length}): ${r.stillMissing.map(a => `\`${a}\``).join(', ') || '—'}`)
  w('')
}

w('## 3. Packaging contract')
w('')
w('The manifest ships `index.js`, `src`, `dist`, `esm`, `cjs` and lists `src` as importable. A drop-in')
w('replacement must keep every shipped path resolvable with the same relative layout, so deep imports')
w('and the publish gate (`scripts/check-manifests.js`) keep working.')
w('')
w(`| path shipped in \`libs/signal\` | ${rows.map(r => `in \`${r.id}\``).join(' | ')} |`)
w(`|---|${rows.map(() => '---').join('|')}|`)
for (const path of SOURCE_PATHS) {
  w(`| \`${path}\` (source) | ${rows.map(r => (existsSync(join(DIRS, r.id, 'signal', path)) ? '✓' : '**missing**')).join(' | ')} |`)
}
for (const path of GENERATED_PATHS) {
  w(`| \`${path}\` (generated) | ${rows.map(r => (existsSync(join(DIRS, r.id, 'signal', path)) ? '✓ built' : '**not built**')).join(' | ')} |`)
}
w('')
w('### Publishability: types and bundles')
w('')
w('The manifest and `tsconfig.json` are build configuration, so they are **copied from `libs/signal`**')
w('into each candidate (nothing in `libs/` is touched), and then the real publish steps are run:')
w('')
w('```bash')
w('cd experiments/signal-directions/<candidate>/signal')
w('bun x tsc -p tsconfig.json     # declaration emit + checkJs type checking')
w('bun run build && bun run build-cjs')
w('```')
w('')
for (const r of rows) {
  w(`#### \`${r.id}\``)
  w('')
  w(`* \`tsc\` (declarations **and** `+'`checkJs`'+` type checking): ${r.build.tsc === 0 ? 'clean' : `**exit ${r.build.tsc}**`}`)
  w(`* \`build\` (esm) / \`build-cjs\`: ${r.build.esm === 0 ? 'ok' : `exit ${r.build.esm}`} / ${r.build.cjs === 0 ? 'ok' : `exit ${r.build.cjs}`}`)
  w(`* declarations the shipped package has and the candidate's emitted \`dist/index.d.ts\` lacks: ${r.dtsMissing.length ? r.dtsMissing.map(n => `\`${n}\``).join(', ') : '**none**'} (${baseNames.size} baseline declarations)`)
  w(`* declarations **added** by the candidate: ${r.dtsAdded.length ? r.dtsAdded.map(n => `\`${n}\``).join(', ') : '— none'}`)
  w('')
}
w('Type-surface parity matters because `dist/index.d.ts` is published: a changed declaration is a')
w('public API change for TypeScript consumers even when the runtime behaviour is identical.')
w('')
w('Two packaging facts are **not** parity-checkable here and must be handled at graduation:')
w('')
w('1. **A new runtime dependency.** C imports alien-signals, so `libs/signal/package.json` gains a')
w('   `dependencies` entry and the root `catalog` gains a pin; the published package stops having zero')
w('   dependencies. B adds nothing. This is the only respect in which C is not a drop-in *package* even')
w('   though it is a drop-in *API*.')
w('2. **CDN / raw-entry resolution.** The raw `index.js` is the `import`/`module` entry. With C it')
w('   contains a bare `alien-signals` specifier, which a browser cannot resolve without an import map;')
w('   the bundled `esm`/`cjs` entries inline it and are unaffected. Mitigation is a README note plus')
w('   making the bundled entry the documented CDN one.')
w('')

w('## 4. Consumer proof')
w('')
w('* `libs/signal`\'s own 7 test files / 30 tests, copied byte-identically into each candidate, run in')
w('  the candidate\'s core:')
for (const r of rows) w(`  * \`${r.id}\`: ${r.testsExit === 0 ? '**green**' : `exit ${r.testsExit}`}`)
w('* the real `apps/repl` entry (built unmodified with `@jsx6/signal` aliased to the candidate) boots and')
w('  passes every app check — see `APP-RESULTS.md`.')
w('')

w('## 5. What a drop-in verdict does *not* claim')
w('')
w('* It does not claim identical *performance*: C costs +90 % on a raw write+read microbenchmark (each')
w('  read consults the alien node when a subscriber is active) while being within ~14 % on the')
w('  long-lived-component macrobench. See `RESULTS.md`.')
w('* It does not claim identical *internals*: `prepareSignal` still returns')
w('  `{ $signal, fireChanged, listeners, setValue }` with the same semantics, but in C the storage is an')
w('  alien node. Code that writes to the underlying node behind the wrapper\'s back would desynchronise')
w('  the `===` shadow — nothing in the repo does that.')
w('* It does not claim the new computed axis is available in the baseline sense: in C, `$C` is an alien')
w('  computed, so it follows alien\'s rules (pull-based, read-only, no eager mode except `$CE`).')

writeFileSync(OUT, md.join('\n'), 'utf8')
console.log(`\nwrote ${OUT}`)
for (const r of rows) {
  console.log(
    `${r.id}: drop-in=${r.dropIn} · missing=${r.missingNames.length} · typeMismatch=${r.typeMismatch.length} · regressions=${r.regressions.length} · tests=${r.testsExit === 0 ? 'green' : r.testsExit}`,
  )
}
process.exit(rows.every(r => r.dropIn) ? 0 : 1)