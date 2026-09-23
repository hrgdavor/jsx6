#!/usr/bin/env bun
/**
 * scripts/check-docs.js — P4-2 sync check for the published tutorial site.
 *
 * The tutorial markdown used to live in four copies (`apps/repl/static/`, `docs/demistify/`,
 * `apps/repl/build/`, `build_dev/`) with nothing keeping them together, so the committed docs
 * copy silently drifted. `apps/repl/static/` is the single source of truth: `bun run docs:build`
 * copies it into `docs/demistify/`, and this script asserts the committed copy still matches.
 *
 * It exits 0 when in sync and 1 with a specific message when it is not.
 *
 * Exported as `checkDocs()` so `scripts/verify.js` can call it as a gate step (it is *not* wired
 * in yet — that file belongs to another work item):
 *
 *   import { checkDocs } from './check-docs.js'
 *   const { errors, warnings } = checkDocs()   // errors.length === 0 means "in sync"
 *
 * Usage:
 *   bun run scripts/check-docs.js             markdown/HTML/asset-reference checks
 *   bun run scripts/check-docs.js --syntax    ... plus a syntax check of the generated JS
 *   bun run scripts/check-docs.js --rebuild   ... plus a full rebuild comparison (slow, strongest)
 */
import { createHash } from 'crypto'
import { spawnSync } from 'child_process'
import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import {
  DOCS_DIR,
  ROOT,
  STAGE_DIR,
  STATIC_DIR,
  STATIC_FILES,
  listFiles,
  renderIndexHtml,
  syntaxCheck,
  validateRefs,
  validateNoOrphanAssets,
} from './build-docs.js'

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function size(path) {
  return statSync(path).size
}

/**
 * Verify the committed `docs/demistify/` against its sources.
 *
 * @param {{ syntax?: boolean, rebuild?: boolean }} [opts]
 * @returns {{ errors: string[], warnings: string[], checked: number }}
 */
export function checkDocs(opts = {}) {
  const errors = []
  const warnings = []
  let checked = 0

  if (!existsSync(DOCS_DIR)) {
    return { errors: [`docs/demistify/ does not exist — run: bun run docs:build`], warnings, checked }
  }

  // 1 — the P4-2 sync check: every file copied from apps/repl/static/ must match byte for byte.
  for (const file of STATIC_FILES) {
    checked++
    const source = join(STATIC_DIR, file)
    const committed = join(DOCS_DIR, file)
    if (!existsSync(committed)) {
      errors.push(`docs/demistify/${file} is missing — run: bun run docs:build`)
      continue
    }
    if (sha256(source) !== sha256(committed)) {
      errors.push(
        `docs/demistify/${file} is out of sync with apps/repl/static/${file} ` +
          `(committed ${size(committed)} B, source ${size(source)} B) — run: bun run docs:build`,
      )
    }
  }

  // 2 — index.html must still be exactly what build-docs renders (catches hand edits and stale
  //     asset names / favicon references).
  checked++
  const indexPath = join(DOCS_DIR, 'index.html')
  if (!existsSync(indexPath)) {
    errors.push('docs/demistify/index.html is missing — run: bun run docs:build')
  } else {
    let expected
    try {
      expected = renderIndexHtml()
    } catch (err) {
      errors.push(`could not render the expected index.html: ${err.message}`)
    }
    if (expected !== undefined && readFileSync(indexPath, 'utf8') !== expected) {
      errors.push(
        'docs/demistify/index.html does not match the page build-docs renders from ' +
          'apps/repl/static/demistify.jsx.online.html (stale asset names, favicon or CDN pin) — ' +
          'run: bun run docs:build',
      )
    }
  }

  // 3 — every local src/href/url() inside the committed site resolves on disk.
  checked++
  if (existsSync(indexPath)) {
    const { errors: refErrors, missing } = validateRefs(DOCS_DIR)
    errors.push(...refErrors)
    for (const m of missing) warnings.push(`missing target: ${m}`)
    errors.push(...validateNoOrphanAssets(DOCS_DIR).map(e => `docs/demistify/${e}`))
  }

  // 4 — optional: the generated JS parses.
  if (opts.syntax) {
    checked++
    const js = listFiles(DOCS_DIR)
      .filter(f => f.endsWith('.js'))
      .map(f => join(DOCS_DIR, f))
    errors.push(...syntaxCheck(js, join(STAGE_DIR, '.check-syntax')))
  }

  // 5 — optional: rebuild from source and compare every file (the strongest drift check; needs
  //     esbuild, so it stays opt-in). The rebuild runs through the build-docs CLI so that this
  //     function stays synchronous for `scripts/verify.js`.
  if (opts.rebuild) {
    checked++
    const args = ['run', join(ROOT, 'scripts/build-docs.js'), '--stage']
    if (process.argv.includes('--map')) args.push('--map')
    const res = spawnSync(process.execPath, args, { stdio: 'inherit' })
    if (res.error) {
      errors.push(`could not re-run docs:build: ${res.error.message}`)
    } else if (res.status !== 0) {
      errors.push('docs:build failed — see its output above')
    } else {
      const staged = listFiles(STAGE_DIR).filter(f => !f.startsWith('.'))
      const committed = listFiles(DOCS_DIR).filter(f => !f.startsWith('.'))
      for (const file of staged) {
        if (!committed.includes(file)) {
          errors.push(`docs/demistify/${file} is missing from the committed site — run: bun run docs:build`)
        } else if (sha256(join(STAGE_DIR, file)) !== sha256(join(DOCS_DIR, file))) {
          errors.push(
            `docs/demistify/${file} differs from a fresh build (committed ${size(join(DOCS_DIR, file))} B, ` +
              `fresh ${size(join(STAGE_DIR, file))} B) — run: bun run docs:build`,
          )
        }
      }
      for (const file of committed) {
        if (!staged.includes(file)) {
          errors.push(`docs/demistify/${file} is not produced by docs:build (stale orphan) — delete it or run: bun run docs:build`)
        }
      }
    }
  }

  return { errors, warnings, checked }
}

if (import.meta.main) {
  const opts = {
    syntax: process.argv.includes('--syntax'),
    rebuild: process.argv.includes('--rebuild'),
  }
  const { errors, warnings, checked } = checkDocs(opts)
  for (const w of warnings) console.log(`[warn] ${w}`)
  for (const e of errors) console.error(`[error] ${e}`)
  const modes = ['markdown+html+assets', opts.syntax && 'syntax', opts.rebuild && 'rebuild']
    .filter(Boolean)
    .join(', ')
  if (errors.length) {
    console.error(`\n${errors.length} problem(s) — docs/demistify/ is out of sync (${modes})`)
    process.exit(1)
  }
  console.log(`docs/demistify/ is in sync with apps/repl/static/ (${checked} check(s): ${modes})`)
  console.log(`committed size: ${listFiles(DOCS_DIR).reduce((n, f) => n + size(join(DOCS_DIR, f)), 0)} B`)
}