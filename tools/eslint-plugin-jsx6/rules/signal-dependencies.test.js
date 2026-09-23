/**
 * The 13-case suite for `jsx6/signal-dependencies`, ported from the ESLint `RuleTester` file to
 * bun:test. ESLint is no longer a dependency of this repo, so the rule is exercised directly
 * against Oxlint: each case is written to a temporary fixture file next to a minimal
 * `.oxlintrc.json` that loads this plugin through `jsPlugins`, and the repo-local Oxlint CLI is
 * run with `-f json`. The assertions check Oxlint's JSON diagnostics in place of
 * `RuleTester`'s `errors` objects.
 */
import { test, expect } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const PLUGIN = join(ROOT, 'tools/eslint-plugin-jsx6/index.js')
const OXLINT_CLI = join(ROOT, 'node_modules/oxlint/bin/oxlint')
const RULE_CODE = 'jsx6(signal-dependencies)'

/**
 * Run the local Oxlint CLI (via the Bun runtime, like the gate) over one fixture and return the
 * parsed `-f json` report.
 */
function lint(code, label) {
  const dir = mkdtempSync(join(ROOT, '.tmp', 'oxlint-signal-'))
  try {
    writeFileSync(
      join(dir, '.oxlintrc.json'),
      JSON.stringify({ jsPlugins: [PLUGIN], rules: { 'jsx6/signal-dependencies': 'warn' } }, null, 2),
    )
    const fixture = join(dir, 'probe.js')
    writeFileSync(fixture, code + '\n')
    const result = spawnSync(process.execPath, [OXLINT_CLI, fixture, '-f', 'json'], {
      cwd: ROOT,
      encoding: 'utf8',
    })
    expect(result.status, `oxlint exited ${result.status} for ${label}: ${result.stderr}`).toBe(0)
    return JSON.parse(result.stdout)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const VALID = [
  { label: 'simple case', code: '$S(() => $sig1() + $sig2(), $sig1, $sig2)' },
  { label: 'filter case', code: '$F(v => v + 1, $sig1)' },
  { label: 'multiple deps', code: '$F((v1, v2) => v1 + v2, $sig1, $sig2)' },
  { label: 'local variable (not a signal usage)', code: '$S(() => { const x = 1; return x; })' },
  { label: 'signal usage passed as $F argument', code: '$F($sigParam => $sigParam(), $sig1)' },
  { label: 'signal bucket, full path', code: '$S(() => $state.user.name(), $state.user.name)' },
  { label: 'signal bucket, root path', code: '$S(() => $state.user.name(), $state)' },
  { label: 'simpler bucket, full path', code: '$S(() => $user.name(), $user.name)' },
  { label: 'simpler bucket, root path', code: '$S(() => $user.name(), $user)' },
]

const INVALID = [
  { label: 'missing dependency', code: '$S(() => $sig1() + $sig2(), $sig1)', name: '$sig2' },
  {
    label: 'missing signal bucket dependency',
    code: '$S(() => $state.user.name())',
    name: '$state.user.name',
  },
  { label: 'missing simpler bucket dependency', code: '$S(() => $user.name())', name: '$user.name' },
  { label: 'unrelated dependency listed', code: '$S(() => $user.name(), $sig1)', name: '$user.name' },
]

test('signal-dependencies: valid cases report nothing under Oxlint', () => {
  for (const { label, code } of VALID) {
    const report = lint(code, label)
    expect(report.diagnostics, `${label}: expected no diagnostics`).toEqual([])
  }
})

test('signal-dependencies: invalid cases report one finding each under Oxlint', () => {
  for (const { label, code, name } of INVALID) {
    const report = lint(code, label)
    const findings = report.diagnostics.filter(d => d.code === RULE_CODE)
    expect(findings.length, `${label}: expected exactly one ${RULE_CODE} finding`).toBe(1)
    const finding = findings[0]
    expect(finding.severity).toBe('warning')
    expect(finding.message, `${label}`).toContain(`"${name}"`)
  }
})
