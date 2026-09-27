/**
 * Guard for the backend seam: `src/runtime-default.js` is the ONLY file in the package that imports
 * a `@jsx6/*` package — library and demo alike — and everything else reaches the backend through
 * `backend.current` (with `setRuntime()` to replace it).
 *
 * This is what keeps the seam from rotting: without it, the next `import { insert } from
 * '@jsx6/jsx6'` added to a random file silently re-couples nodditor to the real implementation, and
 * that only shows up much later as "replacing the runtime did not replace everything".
 *
 * The demo surface (`src/index.jsx`, `src/blocks/*`) is held to the same rule: it uses the editor's
 * public API and plain DOM, so it needs no jsx6 import at all. It is still listed explicitly so
 * that a future demo convenience import fails here rather than quietly re-opening a second door
 * into the framework.
 */
import { expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

import { backend, hasRuntimeOverride, setRuntime } from '../src/runtime.js'

const ROOT = join(dirname(import.meta.dir), 'src')
const DEFAULT_BACKEND = join(ROOT, 'runtime-default.js')
/** The JSX demo page and its block components: they must be jsx6-free too (see the header). */
const DEMO_SURFACE = ['index.jsx', 'blocks/Switch.js', 'blocks/Message.js']

/** Every `.js`/`.jsx` under `src/`, recursively. */
function sourceFiles(dir = ROOT) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFiles(full))
    else if (/\.jsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

/** Bare `@jsx6/...` specifiers a file imports (static import/export, require, dynamic import). */
function jsx6Imports(source) {
  const found = new Set()
  const patterns = [
    /(?:^|[\n;}])\s*(?:import|export)\b[^;'"]*?\bfrom\s*['"](@jsx6\/[^'"]+)['"]/g,
    /(?:^|[\n;}])\s*import\s*['"](@jsx6\/[^'"]+)['"]/g,
    /\brequire\s*\(\s*['"](@jsx6\/[^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"](@jsx6\/[^'"]+)['"]\s*\)/g,
  ]
  for (const re of patterns) for (const m of source.matchAll(re)) found.add(m[1])
  return found
}

test('runtime-default.js is the only module importing @jsx6/*', () => {
  // No exemptions — not even the demo surface, which is exactly why DEMO_SURFACE is asserted
  // separately below: a convenience import added there would otherwise be invisible here.
  const offenders = []
  for (const file of sourceFiles()) {
    const rel = relative(ROOT, file).replaceAll('\\', '/')
    if (file === DEFAULT_BACKEND) continue
    const found = jsx6Imports(readFileSync(file, 'utf8'))
    if (found.size) offenders.push(`${rel} -> ${[...found].join(', ')}`)
  }
  expect(offenders).toEqual([])
})

test('the demo surface needs no jsx6 import of its own', () => {
  // The JSX demo page and its blocks use the editor's public API and plain DOM, so nodditor has
  // exactly ONE module that knows jsx6 exists. A demo file importing `@jsx6/*` for convenience would
  // reintroduce a second way into the framework, which is what the seam exists to prevent.
  const used = {}
  for (const rel of DEMO_SURFACE) {
    used[rel] = [...jsx6Imports(readFileSync(join(ROOT, rel), 'utf8'))].sort()
  }
  expect(used).toEqual({
    'index.jsx': [],
    'blocks/Switch.js': [],
    'blocks/Message.js': [],
  })
})

test('the default backend is the four @jsx6 packages the app declares', () => {
  const found = [...jsx6Imports(readFileSync(DEFAULT_BACKEND, 'utf8'))].sort()
  expect(found).toEqual(['@jsx6/dom-observer', '@jsx6/jsx6', '@jsx6/signal', '@jsx6/w'])
})

test('the backend exposes the full surface the editor is written against', () => {
  // Kept explicit on purpose: a new primitive may only enter nodditor through the seam, so the list
  // being reviewable here is the point.
  const expected = [
    '$Or',
    'JsxW',
    'addClass',
    'classIf',
    'define',
    'findParent',
    'fireCustom',
    'getAttr',
    'hSvg',
    'insert',
    'isNode',
    'listen',
    'listenCustom',
    'observeNow',
    'observeShowHide',
    'remove',
    'runFuncNoArg',
    'setAttribute',
    'setSelected',
    'setVisible',
    'toDomNode',
  ].sort()

  const names = Object.keys(backend.current).sort()
  expect(names).toEqual(expected)
  for (const name of names) expect([name, typeof backend.current[name]]).toEqual([name, 'function'])
})

test('setRuntime() replaces primitives and setRuntime(null) restores the default', () => {
  const defaults = backend.current
  expect(hasRuntimeOverride()).toBe(false)

  const calls = []
  let previous
  try {
    previous = setRuntime({
      classIf: (node, name, on) => {
        calls.push([name, on])
        defaults.classIf(node, name, on)
      },
    })
    expect(previous).toBe(null)
    expect(hasRuntimeOverride()).toBe(true)

    // the replacement is in effect…
    expect(backend.current.classIf).not.toBe(defaults.classIf)
    const node = document.createElement('div')
    backend.current.classIf(node, 'seam-probe', true)
    expect(calls).toEqual([['seam-probe', true]])
    expect(node.classList.contains('seam-probe')).toBe(true)
    backend.current.classIf(node, 'seam-probe', false)
    expect(node.classList.contains('seam-probe')).toBe(false)

    // …while everything it did not replace still comes from the default backend
    expect(backend.current.insert).toBe(defaults.insert)
    expect(backend.current.JsxW).toBe(defaults.JsxW)
  } finally {
    setRuntime(previous)
  }

  expect(hasRuntimeOverride()).toBe(false)
  expect(backend.current.classIf).toBe(defaults.classIf)
})
