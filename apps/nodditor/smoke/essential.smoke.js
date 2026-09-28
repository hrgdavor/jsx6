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

/**
 * A data-driven block factory: it renders ITS OWN markup from the block's data, which is the shape
 * this library exists to support. `seen` collects the descriptors it was handed so the audit can
 * assert the factory really receives them.
 */
const dataTypeMap = seen => ({
  Custom: data => {
    seen.push({ ...data })
    const el = document.createElement('div')
    el.className = 'host-markup'
    el.dataset.label = data.label ?? ''
    for (const [ncid, dir] of [
      ['in', 'in'],
      ['out', 'out'],
    ]) {
      const port = document.createElement('span')
      port.setAttribute('ncid', ncid)
      port.setAttribute('ne-connect', dir)
      el.appendChild(port)
    }
    return el
  },
})

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

/* ---- 1b. regression: a block that gains connectors after its first scan ---- */
// `recheckConnectors()` is the host-facing rescan. It used to be memoised, so it silently did
// nothing for a block whose connectors appeared without the canvas MutationObserver having
// noticed — and every line referring to those connectors then failed with "unknown connector".
// This is the shape that broke: build the block empty, scan it, then append the ports.
{
  const late = host.add(document.createElement('div'), 'late1', { type: 'Value', pos: [0, 400] })
  ok(late.connectorMap.size === 0, 'AUDIT-1b a block added empty has no connectors yet')
  const port = document.createElement('span')
  port.setAttribute('ncid', 'o1')
  port.setAttribute('ne-connect', 'out')
  late.el.appendChild(port)
  // `recheckConnectors` is memoised (P3-1), so a host that changed the DOM outside what the canvas
  // MutationObserver can see passes `force` — the exact escape hatch the reporter needed.
  host.recheckConnectors(late, true)
  ok(
    late.connectorMap.has('o1'),
    `AUDIT-1b recheckConnectors(bd, true) discovers a connector added after the first scan (${[...late.connectorMap.keys()].join(',') || 'none'})`,
  )
  // and the discovered connector is usable, which is what the reporter's lines needed
  const sinkPort = document.createElement('span')
  sinkPort.setAttribute('ncid', 'late-in')
  sinkPort.setAttribute('ne-connect', 'in')
  host.getBlockData('2').el.appendChild(sinkPort)
  host.recheckConnectors(host.getBlockData('2'), true)
  ok(host.getConnector('2/late-in') != null, 'AUDIT-1b the sink block discovered its late connector too')
  host.addConnectorFromTo('late1/o1', '2/late-in')
  ok(host.lineExists('late1/o1', '2/late-in') === true, 'AUDIT-1b a line to the late connector loads')

  /* ---- 1c. the data-driven flow: the host renders ports, then wires lines in the SAME task ---- */
  // No explicit rescan here — `addConnectorFromTo` has to cope on its own, which is what a host
  // that renders blocks from data and then generates connectors from that data will do.
  const rendered = host.add(document.createElement('div'), 'rendered1', { type: 'Value', pos: [0, 500] })
  const renderedPort = document.createElement('span')
  renderedPort.setAttribute('ncid', 'o1')
  renderedPort.setAttribute('ne-connect', 'out')
  rendered.el.appendChild(renderedPort)
  const sink = host.getBlockData('3')
  const dataSinkPort = document.createElement('span')
  dataSinkPort.setAttribute('ncid', 'data-in')
  dataSinkPort.setAttribute('ne-connect', 'in')
  sink.el.appendChild(dataSinkPort)
  let wired = null
  try {
    wired = host.addConnectorFromTo('rendered1/o1', '3/data-in')
  } catch (err) {
    ok(false, `AUDIT-1c addConnectorFromTo wired freshly rendered ports — ${err.message}`)
  }
  ok(
    wired !== null && host.lineExists('rendered1/o1', '3/data-in'),
    'AUDIT-1c freshly rendered ports wire without a manual rescan',
  )
  void wired
  host.selectConnector(null)
  host.selectBlocks([rendered])
  host.deleteSelection()
  // put the editor back the way the rest of the audit expects it
  host.selectConnector(null)
  host.selectBlocks([late])
  host.deleteSelection()
  ok(host.getBlockData('late1') == null && host.lines.length === 3, 'AUDIT-1b cleanup restored the graph')
}

/* ---- 1d. the documented data-driven flow: factory renders from data → inspect → lines ---- */
{
  const seen = []
  const dataHost = new NodeEditor({ menu: () => null })
  dataHost.className = 'NodeEditor'
  dataHost.style.cssText = 'width:800px;height:600px'
  document.body.appendChild(dataHost)
  dataHost.typeMap = dataTypeMap(seen)
  dataHost.loadGraph({
    blocks: [
      { id: 'A', type: 'Custom', pos: [10, 20], label: 'from data' }, // extra key: host's own data
      { id: 'B', type: 'Custom', pos: [200, 20], label: 'second' },
    ],
    lines: [],
  })
  ok(
    seen.length === 2 && seen[0].id === 'A' && seen[0].label === 'from data',
    `AUDIT-1d the factory received the block's own data (${JSON.stringify(seen[0])})`,
  )
  ok(
    dataHost.blocks.every(b => b.el.dataset.label !== undefined),
    'AUDIT-1d each block rendered its own markup from that data',
  )
  // the explicit inspection step, before any line exists
  const inspect = dataHost.inspectConnectors()
  ok(
    inspect.length === 4 && inspect.every(c => c.idFull.includes('/')),
    `AUDIT-1d inspectConnectors() reports every rendered connector (${inspect.map(c => c.idFull).join(', ')})`,
  )
  ok(dataHost.getConnectors('A').has('out'), "AUDIT-1d getConnectors(id) exposes one block's connectors")
  // and now the lines, which can only be added because inspection happened first
  const lines = dataHost.loadLines([
    ['A/out', 'B/in'],
    ['A/nope', 'B/in'], // corrupt: no such connector
    ['A/out', 'B/in'], // corrupt: duplicate
    ['B/out', 'A/in'],
  ])
  ok(
    lines.attached === 2 && lines.skipped === 2,
    `AUDIT-1d corrupt line entries are skipped, the rest attach (${lines.attached} attached, ${lines.skipped} skipped)`,
  )
  ok(dataHost.lines.length === 2, `AUDIT-1d both good lines are on screen (${dataHost.lines.length})`)
  ok(dataHost.lineExists('B/out', 'A/in') === true, 'AUDIT-1d the line AFTER a corrupt one still attached')
  dataHost.selectConnector(null)
  dataHost.destroy()
}

/* ---- 1e. a corrupt line in a loaded graph must not cost the document ---- */
{
  const robustHost = new NodeEditor({ menu: () => null, typeMap: dataTypeMap([]) })
  robustHost.className = 'NodeEditor'
  robustHost.style.cssText = 'width:800px;height:600px'
  document.body.appendChild(robustHost)
  const errors = []
  const origError = console.error
  console.error = (...args) => errors.push(args.join(' '))
  try {
    robustHost.loadGraph({
      blocks: [
        { id: '1', type: 'Custom', pos: [0, 0] },
        { id: '2', type: 'Custom', pos: [200, 0] },
      ],
      lines: [
        ['1/out', '2/in'],
        ['1/does-not-exist', '2/in'], // corrupt: the block has no such connector
        ['9/out', '2/in'], // corrupt: no such block
        ['2/out', '1/in'],
      ],
    })
  } finally {
    console.error = origError
  }
  ok(robustHost.lines.length === 2, `AUDIT-1e the valid lines still loaded (${robustHost.lines.length} of 4)`)
  ok(robustHost.lineExists('2/out', '1/in') === true, 'AUDIT-1e the line after the corrupt ones attached')
  ok(errors.length === 2, `AUDIT-1e each bad line was reported to the console (${errors.length})`)
  ok(
    errors[0].includes('skipping line') && errors[0].includes('does-not-exist'),
    `AUDIT-1e the report names the entry and the reason (${errors[0]})`,
  )
  robustHost.destroy()
}

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
