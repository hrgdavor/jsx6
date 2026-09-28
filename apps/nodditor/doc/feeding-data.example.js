/**
 * Feeding host data into the editor — runnable example.
 *
 *   cd apps/nodditor && node doc/feeding-data.run.mjs
 *
 * Reproduces the shape that throws
 *
 *     NodeEditor: "1/onTimeout" is already connected to "2/i1"
 *
 * and proves the three fixes. Everything here is copy-pasteable: `fillPage` is the function a host
 * replaces its `editorFill` with, and `dedupeLines` is the data-side guard.
 *
 * The host situation it models: blocks are added first (their intents are fetched asynchronously, so
 * the ports are rendered later), and the fill can run again whenever the page value changes.
 */
import { NodeEditor } from '../src/NodeEditor.jsx'

/* ---------------------------------------------------------------------------------------------
   The fix. Drop-in replacement for a host `editorFill`.
   --------------------------------------------------------------------------------------------- */

/**
 * De-duplicate line pairs, direction-insensitively (`a→b` and `b→a` are the same edge).
 * Fan-out is preserved: repeats of the SAME pair are dropped, different edges from one output are not.
 * @param {Array<[string, string]>} lines
 * @returns {{ lines: Array<[string, string]>, dropped: number }}
 */
export function dedupeLines(lines) {
  const seen = new Set()
  const out = []
  for (const entry of lines ?? []) {
    const [a, b] = Array.isArray(entry) ? entry : [undefined, undefined]
    const key = [a, b].sort().join('\u0000')
    if (seen.has(key)) continue
    seen.add(key)
    out.push([a, b])
  }
  return { lines: out, dropped: (lines?.length ?? 0) - out.length }
}

/**
 * Fill the editor from page data, IDEMPOTENTLY. Safe to call on every value change.
 *
 * - blocks already present are left alone (no `block id … is already in use`);
 * - ports are discovered before wiring, so an async render does not need a guessed delay;
 * - lines go through `loadLines`, which reports and skips a bad or duplicate entry instead of
 *   throwing, and the data is de-duplicated first so the console stays quiet on a re-run.
 *
 * @param {NodeEditor} editor
 * @param {{ blocks?: Array<any>, conns?: Array<[string, string]> }} page
 * @param {{ make: (block: any) => Element, clear?: boolean }} options
 *   `make(blockData)` renders that block's markup from its data (your existing block factory);
 *   `clear: true` makes the call authoritative — the editor is emptied first, so removed blocks and
 *   lines disappear.
 * @returns {{ added: number, connections: { attached: number, skipped: number }, droppedLines: number }}
 */
export function fillPage(editor, page, { make, clear = false } = {}) {
  if (clear) editor.clear()

  let added = 0
  for (const b of page.blocks ?? []) {
    if (editor.getBlockData(b.id)) continue // leave an existing block untouched
    editor.add(make(b), b.id, { pos: [b.pos?.[0] ?? 0, b.pos?.[1] ?? 0], type: b.type })
    added++
  }

  // discover the connectors the block markup produced (forced scan: works after an async render)
  editor.inspectConnectors()

  const { lines, dropped } = dedupeLines(page.conns)
  const connections = editor.loadLines(lines)
  return { added, connections, droppedLines: dropped }
}

/* ---------------------------------------------------------------------------------------------
   The example: one editor per scenario, driven exactly like a host.
   --------------------------------------------------------------------------------------------- */

const results = []
const ok = (cond, msg) => {
  results.push({ ok: !!cond, msg })
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`)
}

/** A host block factory: renders the block's own markup from its data. */
const makeBlock = data => {
  const el = document.createElement('div')
  el.className = 'ne-block'
  const title = document.createElement('div')
  title.className = 'ne-title'
  title.textContent = data.label ?? data.type
  el.appendChild(title)
  const body = document.createElement('div')
  body.className = 'ne-content'
  for (const [ncid, dir] of data.ports ?? []) {
    const p = document.createElement('b')
    p.setAttribute('ncid', ncid)
    p.setAttribute('ne-connect', dir)
    body.appendChild(p)
  }
  el.appendChild(body)
  return el
}

const page = () => ({
  blocks: [
    // the reporter's block: one output named `onTimeout`, plus a second output
    {
      id: '1',
      type: 'Menu',
      label: 'Menu',
      ports: [
        ['onTimeout', 'out'],
        ['finalError', 'out'],
      ],
      pos: [30, 30],
    },
    {
      id: '2',
      type: 'Menu',
      label: 'Next',
      ports: [
        ['i1', 'in'],
        ['i2', 'in'],
      ],
      pos: [300, 30],
    },
  ],
  conns: [
    ['1/onTimeout', '2/i1'],
    ['1/onTimeout', '2/i1'], // ← duplicate entry: this is what throws in a forEach
    ['2/i1', '1/onTimeout'], // ← the same edge, reversed
    ['1/finalError', '2/i2'], // distinct edge from a different output: must survive
  ],
})

const newEditor = () => {
  const ed = new NodeEditor({ menu: () => null })
  ed.className = 'NodeEditor'
  ed.style.cssText = 'width:800px;height:600px'
  document.body.appendChild(ed)
  return ed
}

/** What the host has today: a forEach over the raw data. Throws, and the throw aborts the fill. */
const legacyFill = (editor, p, make) => {
  for (const b of p.blocks) {
    if (editor.getBlockData(b.id)) continue
    editor.add(make(b), b.id, { pos: b.pos ?? [0, 0], type: b.type })
  }
  p.conns.forEach(([a, b]) => editor.addConnectorFromTo(a, b))
}

/* ---- 1. the error, reproduced ---- */
{
  const ed = newEditor()
  let error = null
  // silence the console while we provoke the failure on purpose
  const orig = console.error
  try {
    legacyFill(ed, page(), makeBlock)
  } catch (err) {
    error = err.message
  }
  console.error = orig
  ok(
    error !== null && error.includes('already connected'),
    `the raw forEach throws on the duplicate entry (${error})`,
  )
  ed.destroy()
}

/* ---- 2. the error also breaks the fill halfway ---- */
{
  const ed = newEditor()
  const orig = console.error
  let error = null
  try {
    legacyFill(ed, page(), makeBlock)
  } catch (err) {
    error = err.message
  }
  console.error = orig
  ok(
    ed.lines.length === 1,
    `the throw aborts the fill, so the later valid edge is lost (${ed.lines.length} of 2 lines, error=${!!error})`,
  )
  ed.destroy()
}

/* ---- 3. dedupeLines keeps fan-out ---- */
{
  const { lines, dropped } = dedupeLines(page().conns)
  ok(dropped === 2, `dedupeLines drops the repeat and the reversed twin (${dropped} of 4)`)
  ok(
    lines.length === 2 && lines.some(([, b]) => b === '2/i2'),
    `the distinct edge survives (${lines.length} edges: ${lines.map(l => l.join('→')).join(', ')})`,
  )
}

/* ---- 4. fillPage: duplicates skipped, no throw ---- */
{
  const ed = newEditor()
  const errors = []
  const orig = console.error
  console.error = (...a) => errors.push(a.join(' '))
  let fail = null
  let out = null
  try {
    out = fillPage(ed, page(), { make: makeBlock })
  } catch (err) {
    fail = err.message
  }
  console.error = orig
  ok(fail === null, `fillPage does not throw (${fail ?? 'clean'})`)
  ok(out?.connections.attached === 2, `both distinct edges attached (${out?.connections.attached})`)
  ok(out?.connections.skipped === 0, `nothing was skipped, because the data was de-duplicated first`)
  ok(errors.length === 0, `the console stays quiet (${errors.length} report(s))`)
  ed.destroy()
}

/* ---- 5. fillPage is idempotent: run it again on the same editor ---- */
{
  const ed = newEditor()
  const orig = console.error
  const errors = []
  console.error = (...a) => errors.push(a.join(' '))
  let fail = null
  let second = null
  try {
    fillPage(ed, page(), { make: makeBlock })
    second = fillPage(ed, page(), { make: makeBlock })
  } catch (err) {
    fail = err.message
  }
  console.error = orig
  ok(fail === null, `a second fill of the same data throws nothing (${fail ?? 'clean'})`)
  ok(second?.added === 0, `no block was re-added (added=${second?.added})`)
  ok(ed.blocks.length === 2, `blocks are not duplicated (${ed.blocks.length})`)
  ok(ed.lines.length === 2, `lines are not duplicated (${ed.lines.length})`)
  ed.destroy()
}

/* ---- 6. tolerate genuinely bad line data (unknown endpoint) ---- */
{
  const ed = newEditor()
  const orig = console.error
  const errors = []
  console.error = (...a) => errors.push(a.join(' '))
  const p = page()
  p.conns = [
    ['1/onTimeout', '2/i1'],
    ['1/does-not-exist', '2/i2'], // corrupt
    ['1/finalError', '2/i2'],
  ]
  const out = fillPage(ed, p, { make: makeBlock })
  console.error = orig
  ok(
    out.connections.attached === 2,
    `the good edges still attach past the corrupt one (${out.connections.attached})`,
  )
  ok(out.connections.skipped === 1, `the corrupt entry is skipped, not fatal (${out.connections.skipped})`)
  ok(
    errors.some(e => e.includes('does not exist in block "1"')) &&
      errors.some(e => e.includes('discovered there')),
    'the report names the block and the connectors it does have',
  )
  ed.destroy()
}

/* ---- 7. `clear: true` makes the fill authoritative ---- */
{
  const ed = newEditor()
  const first = page()
  fillPage(ed, first, { make: makeBlock, clear: true })
  const fewer = page()
  fewer.blocks = fewer.blocks.slice(0, 1) // block 2 was deleted on the server
  fewer.conns = []
  fillPage(ed, fewer, { make: makeBlock, clear: true })
  ok(ed.blocks.length === 1, `an authoritative fill drops the removed block (${ed.blocks.length})`)
  ok(ed.lines.length === 0, `and its lines (${ed.lines.length})`)
  ed.destroy()
}

/* ---- 8. async ports: no guessed delay needed ---- */
{
  const ed = newEditor()
  const late = page()
  // block 1 arrives with NO ports (the intents have not been fetched yet)
  late.blocks[0] = { ...late.blocks[0], ports: [] }
  fillPage(ed, late, { make: makeBlock })
  ok(ed.getConnectors('1').size === 0, 'before the intents arrive the block has no connectors')

  // the host re-renders that block's ports in place, then re-runs the same fill
  const blockEl = ed.getBlockData('1').el
  const body = blockEl.querySelector('.ne-content')
  for (const [ncid, dir] of page().blocks[0].ports) {
    const p = document.createElement('b')
    p.setAttribute('ncid', ncid)
    p.setAttribute('ne-connect', dir)
    body.appendChild(p)
  }
  const out = fillPage(ed, page(), { make: makeBlock })
  ok(
    ed.getConnectors('1').size === 2,
    `the late ports were discovered without a delay (${[...ed.getConnectors('1').keys()].join(', ')})`,
  )
  ok(out.connections.attached === 2, `and both lines attached on that pass (${out.connections.attached})`)
  ed.destroy()
}

/* ---- 9. host block classes are untouched ---- */
{
  const ed = newEditor()
  fillPage(ed, page(), { make: makeBlock, clear: true })
  const el = ed.getBlockData('1').el
  ok(
    !!el.querySelector('.ne-content') && !!el.querySelector('.ne-title'),
    'the host block structure survives the fill (.ne-title + .ne-content present)',
  )
  ok(ed.contentArea.className === 'ne-canvas', `the canvas keeps its own class (${ed.contentArea.className})`)
  ed.destroy()
}

const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
process.exitCode = failed.length ? 1 : 0
