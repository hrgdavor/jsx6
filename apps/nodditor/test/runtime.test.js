/**
 * Guard for the backend seam: `src/runtime-default.js` is the only module in the package allowed to
 * import a `@jsx6/*` package, and everything else reaches the backend through `backend.current`
 * (with `setRuntime()` to replace it).
 *
 * The first test is what keeps the seam from rotting: without it, the next
 * `import { insert } from '@jsx6/jsx6'` added to a random file silently re-couples nodditor to the
 * real implementation, and that only shows up much later as "replacing the runtime did not replace
 * everything".
 */
import { expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

import { backend, hasRuntimeOverride, setRuntime } from '../src/runtime.js'

const ROOT = join(dirname(import.meta.dir), 'src')
const DEFAULT_BACKEND = join(ROOT, 'runtime-default.js')

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
  const offenders = []
  for (const file of sourceFiles()) {
    if (file === DEFAULT_BACKEND) continue
    const found = jsx6Imports(readFileSync(file, 'utf8'))
    if (found.size) offenders.push(`${relative(ROOT, file)} -> ${[...found].join(', ')}`)
  }
  expect(offenders).toEqual([])
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
    '$State',
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
    'provideErrTranslations',
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
      addClass: (node, name) => {
        calls.push(name)
        defaults.addClass(node, name)
      },
    })
    expect(previous).toBe(null)
    expect(hasRuntimeOverride()).toBe(true)

    // the replacement is in effect…
    expect(backend.current.addClass).not.toBe(defaults.addClass)
    const node = document.createElement('div')
    backend.current.addClass(node, 'seam-probe')
    expect(calls).toEqual(['seam-probe'])
    expect(node.classList.contains('seam-probe')).toBe(true)

    // …while everything it did not replace still comes from the default backend
    expect(backend.current.insert).toBe(defaults.insert)
    expect(backend.current.JsxW).toBe(defaults.JsxW)
  } finally {
    setRuntime(previous)
  }

  expect(hasRuntimeOverride()).toBe(false)
  expect(backend.current.addClass).toBe(defaults.addClass)
})
