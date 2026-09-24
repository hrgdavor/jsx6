/**
 * Runs the frozen contract (§4.1 of the portfolio) against one direction module.
 *
 * A direction is identified by a path relative to this file; it must export the names listed in
 * `contract.md` plus a `meta` object:
 *
 *   export const meta = {
 *     id: 'a-compat',
 *     name: 'A — compatibility layer',
 *     backend: 'current core + alien bridge',
 *     capabilities: ['core', 'interop'],
 *     deps: ['alien-signals (vendored)'],
 *     sourceRoot: '.',            // where the direction's own code lives (for the LOC count)
 *   }
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { cases } from './contract.js'

const HERE = import.meta.dir

/** Count non-blank, non-comment-only source lines of a direction's JavaScript (ergonomics input). */
export function countLoc(root, { exclude = ['node_modules', 'vendor', '.git'] } = {}) {
  let lines = 0
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || exclude.includes(entry.name)) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(js|mjs)$/.test(entry.name)) continue
      if (/\.test\.js$/.test(entry.name)) continue
      const text = readFileSync(full, 'utf8')
      for (const line of text.split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) continue
        lines++
      }
    }
  }
  try {
    if (statSync(root).isDirectory()) walk(root)
  } catch {
    return 0
  }
  return lines
}

/**
 * @param {string} modulePath path to the direction's entry module, relative to the harness dir
 * @returns {Promise<{meta: any, results: any[], passed: number, failed: number, skipped: number}>}
 */
export async function runDirection(modulePath, { only } = {}) {
  const api = await import(modulePath.startsWith('.') ? modulePath : resolve(HERE, modulePath))
  const meta = api.meta || { id: modulePath, name: modulePath, capabilities: ['core'] }
  const caps = new Set(meta.capabilities || ['core'])
  const results = []

  for (const c of cases) {
    if (only && !only.includes(c.id)) continue
    const missing = (c.requires || []).filter(r => !caps.has(r))
    if (missing.length) {
      results.push({ id: c.id, status: 'skipped', reason: `missing capability: ${missing.join(', ')}` })
      continue
    }
    try {
      await c.run(api)
      results.push({ id: c.id, status: 'passed' })
    } catch (e) {
      results.push({ id: c.id, status: 'failed', reason: (e && e.message) || String(e) })
    }
  }

  const passed = results.filter(r => r.status === 'passed').length
  const failed = results.filter(r => r.status === 'failed').length
  const skipped = results.filter(r => r.status === 'skipped').length
  return { meta, results, passed, failed, skipped, api }
}

export const formatResults = ({ meta, passed, failed, skipped, results }) => {
  const lines = [`${meta.id} — ${meta.name} [${passed} passed, ${failed} failed, ${skipped} skipped]`]
  for (const r of results) {
    if (r.status === 'failed') lines.push(`  ✗ ${r.id}: ${r.reason}`)
  }
  for (const r of results) {
    if (r.status === 'skipped') lines.push(`  – ${r.id} (${r.reason})`)
  }
  return lines.join('\n')
}
