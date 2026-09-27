/**
 * Essential-surface audit — drives the VANILLA demo (no JSX, no jsx6 component model, no signals)
 * under happy-dom and reports which backend primitives a real session actually touches, versus
 * which are imported by the library but never exercised.
 *
 * Script-style suite (not `*.test.jsx`): it needs the DOM globals and the bundling done by
 * essential.run.mjs.
 *
 * What this answers: "why does nodditor need so much from jsx6?" — because some of that surface is
 * only used by the JSX demo page, the JSX blocks, or the tests. Anything this session does NOT call
 * is a candidate to move behind the seam (or to drop).
 *
 * The audit wraps `backend.current` in a recording Proxy, so the counts are measurements of the
 * EDITOR's behaviour, not of the imports.
 */
import { startVanillaDemo } from '../static/vanilla/demo.js'
import { NodeEditor } from '../src/NodeEditor.jsx'
import { backend, setRuntime } from '../src/runtime.js'

let failures = 0
const ok = (cond, msg) => {
  if (cond) console.log('ok   ' + msg)
  else {
    failures++
    console.error('FAIL ' + msg)
  }
}

const counts = new Map()
const bump = name => counts.set(name, (counts.get(name) || 0) + 1)

/**
 * Wrap the real backend, counting every primitive the editor reaches for. Call semantics are
 * preserved exactly (same arguments, same return value, same `this`), so this only observes.
 */
function instrument(real) {
  const wrapped = {}
  for (const name of Object.keys(real)) {
    const value = real[name]
    if (typeof value !== 'function') {
      wrapped[name] = value
      continue
    }
    wrapped[name] = function (...args) {
      bump(name)
      return value.apply(this === wrapped ? real : this, args)
    }
  }
  return wrapped
}

const real = backend.current
setRuntime(instrument(real))
ok(backend.current.addClass !== real.addClass, 'audit: the recording backend is installed')

// `addClass` is a real contract member (a props OBJECT gets its `class` string extended, an element
// gets `classList.add`), so it is asserted here rather than assumed. The vanilla demo's blocks do not
// use it — they write their own class — but a host component may, and the editor's contract must keep
// the merge behaviour for that case.
{
  const props = { class: 'host-class' }
  backend.current.addClass(props, 'ne-block')
  ok(
    props.class === 'host-class ne-block',
    `audit: addClass merges onto a props object instead of clobbering it (${props.class})`,
  )
  const el = document.createElement('div')
  backend.current.addClass(el, 'ne-block')
  ok(el.classList.contains('ne-block'), 'audit: addClass also works on a real element')
}

// ---------------------------------------------------------------- the vanilla host
// The demo page gets its editor from the `<jsx6-nodditor>` element being upgraded, which requires
// the element to be in the DOM after the class is registered. Here the class is addressed directly
// — the same constructor that tag resolves to — so the audit does not depend on upgrade timing.
const host = new NodeEditor({ menu: () => null })
host.className = 'NodeEditor'
host.style.cssText = 'width:800px;height:600px'
document.body.appendChild(host)
ok(host instanceof NodeEditor, 'audit: host is the NodeEditor custom element class')

const statuses = []
const demo = startVanillaDemo(host, { persist: false, onStatus: s => statuses.push(s) })
ok(demo === host, 'audit: startVanillaDemo wired the host')

// `host.loadGraph` inside startVanillaDemo happened synchronously, and `typeMap` is called per block
ok(host.blocks.length === 4, `audit: the default graph loaded (${host.blocks.length} blocks)`)
ok(host.lines.length === 3, `audit: the default lines were restored (${host.lines.length} lines)`)
ok(
  host.blocks.every(b => b.el.classList.contains('vb')),
  'audit: blocks are plain DOM elements from the demo factories',
)

const beforeOps = new Map(counts)
const round = name => (counts.get(name) || 0) - (beforeOps.get(name) || 0)

/* ---- 1. the demo's own claims: blocks are plain DOM, nothing jsx6-shaped ---- */
const blockEls = host.blocks.map(b => b.el)
ok(
  blockEls.every(el => el instanceof HTMLElement && !el.isJsx6 && !el._$s && !el._$v),
  'AUDIT-1 blocks carry no jsx6 component state (no isJsx6 / $s / $v)',
)
const conEls = host.blocks.flatMap(b => [...b.connectorMap.values()].map(c => c.el))
const ncidEls = host.blocks.flatMap(b => [...b.el.querySelectorAll('[ncid]')])
ok(
  conEls.length === ncidEls.length,
  `AUDIT-1 every [ncid] element was discovered as a connector (${conEls.length} of ${ncidEls.length})`,
)
ok(conEls.length > 0 && conEls.length === 8, `AUDIT-1 connectors come from plain spans (${conEls.length})`)
ok(
  conEls.every(el => el.tagName === 'SPAN' || el.tagName === 'B'),
  'AUDIT-1 connectors are ordinary elements',
)

/* ---- 2. selection + menu ---- */
const first = host.getBlockData('1')
const second = host.getBlockData('2')
try {
  host.selectBlocks([first, second])
  ok(host.selectedBlocks.length === 2, 'AUDIT-2 selectBlocks() works on vanilla elements')
  const mounted = host.currentMenu
  ok(
    mounted !== null && mounted !== undefined && mounted.parentNode !== null,
    `AUDIT-2 the host-provided menu is mounted on selection (menu=${mounted?.className}, parent=${mounted?.parentNode?.nodeName})`,
  )
} catch (err) {
  ok(false, `AUDIT-2 selectBlocks() with a mounted menu threw: ${err.message}\n${err.stack}`)
}

/* ---- 3. move + event ---- */
const moves = []
host.addEventListener('ne-move-done', e => moves.push(e.detail))
host.setPos('1', [200, 120])
host.fireMoveDone(host.getBlockData('1'))
ok(first.pos[0] === 200 && first.pos[1] === 120, 'AUDIT-3 setPos moved the block')
ok(moves.length === 1, 'AUDIT-3 ne-move-done fired for the host to persist on')
ok(beforeOps.get('fireCustom') !== counts.get('fireCustom'), 'AUDIT-3 the move went through fireCustom')

/* ---- 4. connect ---- */
host.selectBlocks([])
const value = host.add(host.typeMap.Value(), 'v1', { type: 'Value', pos: [0, 300] })
host.addConnectorFromTo('v1/o1', '2/i1')
ok(host.lines.length === 4, `AUDIT-4 addConnectorFromTo linked vanilla blocks (${host.lines.length} lines)`)
ok(host.lineExists('v1/o1', '2/i1') === true, 'AUDIT-4 lineExists sees the new line')

/* ---- 5. undo / redo ---- */
host.undo()
ok(host.lines.length === 3, `AUDIT-5 undo() removed the added line (${host.lines.length})`)
host.redo()
ok(host.lines.length === 4, `AUDIT-5 redo() restored it (${host.lines.length})`)

/* ---- 6. zoom / pan / fit ---- */
const zoomBefore = host.zoom
host.addEventListener('wheel', e => host.changeZoomMouse(e.deltaY > 0 ? -0.1 : 0.1, e))
host.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }))
ok(host.zoom > zoomBefore, `AUDIT-6 wheel zoom changed the zoom (${zoomBefore} -> ${host.zoom})`)
host.resetView()
ok(Number.isFinite(host.zoom), 'AUDIT-6 resetView() ran')

/* ---- 7. persistence + delete ---- */
const json = JSON.parse(JSON.stringify(host.saveGraph()))
ok(json.blocks.length === 5 && json.lines.length === 4, 'AUDIT-7 saveGraph() round-trips as plain JSON')

// `value` is a STALE BlockData: undo/redo rebuild the entire graph through `loadGraph`, so every
// BlockData object is replaced while the ids stay the same. Hosts must re-read by id.
ok(host.blocks.indexOf(value) === -1, 'AUDIT-7 BlockData from before an undo/redo is stale')
const fresh = host.getBlockData('v1')
ok(fresh !== value && fresh.id === 'v1', 'AUDIT-7 getBlockData(id) returns the live BlockData')
// `removeBlock` matches by reference, so a stale object is silently ignored rather than throwing
host.removeBlock(value)
ok(
  host.blocks.some(b => b.id === 'v1'),
  'AUDIT-7 removeBlock() with a stale BlockData is a silent no-op',
)

// NOTE the explicit `selectConnector(null)`: `deleteSelection()` acts on the selected LINE when one
// is selected, and a line selection is sticky — a host showing one menu for both must clear it, or
// "delete" removes the line instead of the blocks.
host.selectConnector(null)
host.selectBlocks([fresh])
host.deleteSelection()
ok(
  host.blocks.every(b => b.id !== 'v1'),
  'AUDIT-7 deleteSelection() removed the block',
)
ok(host.lines.length === 3, 'AUDIT-7 its line went with it')

/* ---- 8. destroy ---- */
host.destroy()
ok(host.blocks.length === 0 && host.lines.length === 0, 'AUDIT-8 destroy() emptied the editor')

setRuntime(null)

/* ---------------------------------------------------------------- the report */
const contract = Object.keys(real)
const used = contract.filter(name => (counts.get(name) || 0) > 0)
const unused = contract.filter(name => !(counts.get(name) || 0))

console.log('\n=== essential surface: what a real VANILLA session calls (of the backend contract) ===')
console.log(`contract: ${contract.length} names — used in this session: ${used.length}, unused: ${unused.length}\n`)
for (const name of used.sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0))) {
  console.log(`  ${name.padEnd(22)} ${String(counts.get(name)).padStart(5)}`)
}
console.log('\nnever called by this session (candidates to move out of the essential path):')
for (const name of unused.sort()) console.log(`  ${name}`)

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL AUDIT ASSERTIONS PASSED')
process.exitCode = failures ? 1 : 0
