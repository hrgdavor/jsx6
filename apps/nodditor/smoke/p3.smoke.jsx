/**
 * P3 smoke test — runs the real editor under happy-dom (globals registered,
 * IntersectionObserver stubbed and ResizeObserver replaced by a manual stub, so
 * the editor's real resize handler can be driven with `ed.observer.cb(...)`).
 * Asserts the Task P3 performance behaviors:
 *
 *  P3-1 memoized connector discovery: `recheckConnectors` and the resize
 *       handler do NOT walk the block subtree unless it changed structurally
 *       (walks counted via `getAttribute('ncid')`), the cached `resizeSet`
 *       survives, and a real DOM change IS discovered on its own (the canvas
 *       MutationObserver marks the block dirty and schedules one rescan)
 *  P3-2 batched `ne-move`: moved connectors are queued and flushed as ONE
 *       event per batch (`{stamp, connectors}`, entry shape = the old
 *       per-connector detail), lines still follow their endpoints, block-level
 *       `ne-move`/`ne-move-done` keep their shape and are never reordered
 *       ahead of the batch they follow
 *  P3-3 selection of a big graph stays exact
 *  P3-4 the menu box is measured once and reused until its content changes;
 *       `fireMoveDone` positions the menu synchronously (no `setTimeout` gap)
 *  P3-5 the connect drag resolves `document.elementFromPoint` at most once per
 *       frame (plus a flush on release, so no connect is lost)
 *  stress: 200 blocks panned for 60 frames → 60 events, not 60 × 800
 */
import { NodeEditor } from '../src/NodeEditor.jsx'
import { moveMenu } from '../src/moveMenu.js'
import { Message } from '../src/blocks/Message.js'
import { Switch } from '../src/blocks/Switch.js'

let failures = 0
const ok = (cond, msg) => {
  if (cond) console.log('ok   ' + msg)
  else {
    failures++
    console.error('FAIL ' + msg)
  }
}
// let queued microtasks (the P3-1 rescan, the P3-2 flush) and rAF callbacks run
const tick = (ms = 20) => new Promise(r => setTimeout(r, ms))
const totalConnectors = ed => ed.blocks.reduce((a, b) => a + b.connectorMap.size, 0)

const typeMap = { Switch: () => <Switch />, Message: () => <Message /> }
const mkMenu = () => {
  const el = <div class="ne-menu"></div>
  return [el, () => el]
}

// ---------- instrumentation: count the connector subtree walks ----------
const origGetAttr = Element.prototype.getAttribute
let ncidReads = 0
Element.prototype.getAttribute = function (n) {
  if (n === 'ncid') ncidReads++
  return origGetAttr.call(this, n)
}
const countNcidReads = fn => {
  ncidReads = 0
  fn()
  return ncidReads
}

const N = 200
const [menuEl, menuFn] = mkMenu()
const ed = new NodeEditor({ menu: menuFn, typeMap })
document.body.appendChild(ed)
ed.contentArea.setPointerCapture = () => {}
ed.contentArea.releasePointerCapture = () => {}

const graph = { blocks: [], lines: [['1/o1', '2/i1']] }
for (let i = 1; i <= N; i++) graph.blocks.push({ id: String(i), type: 'Switch', pos: [i * 120, i * 90] })
ed.loadGraph(graph, typeMap)
const perBlock = ed.getBlockData('1').connectorMap.size
ok(ed.blocks.length === N && perBlock === 4, `P3 setup: ${N} blocks × ${perBlock} connectors`)
const conTotal = totalConnectors(ed)

// `ne-move`/`ne-move-done` probe (the P3-2 batch + the legacy block-level shape)
let moves = []
let doneEvents = []
let order = []
let legacyConEvents = 0
ed.addEventListener('ne-move', e => {
  moves.push(e.detail)
  order.push('ne-move')
})
ed.addEventListener('ne-move-done', e => {
  doneEvents.push(e.detail)
  order.push('ne-move-done')
})
const reset = () => {
  moves = []
  doneEvents = []
  order = []
}
const roEntry = (target, w, h) => ({
  target,
  contentRect: {},
  borderBoxSize: [{ inlineSize: w, blockSize: h }],
})

// ---------- P3-1: memoized connector discovery ----------
const bd1 = ed.getBlockData('1')
ok(bd1.structDirty === false, 'P3-1 a freshly scanned block is not dirty')
const resizeSet0 = bd1.resizeSet
ok(!!resizeSet0 && resizeSet0.size > 1, 'P3-1 the scan installed a live resizeSet')
let walks = countNcidReads(() => ed.recheckConnectors(bd1))
ok(walks === 0, 'P3-1 recheck of an unchanged block walks ZERO elements')
ok(bd1.resizeSet === resizeSet0, 'P3-1 the cached resizeSet is reused')
walks = countNcidReads(() => {
  bd1.structDirty = true
  ed.recheckConnectors(bd1)
})
ok(walks >= 5, `P3-1 a dirty block is walked again (${walks} ncid reads)`)
ok(bd1.resizeSet !== resizeSet0 && bd1.structDirty === false, 'P3-1 the scan cleared the dirty flag')

// the real ResizeObserver handler: a block resize refreshes positions but
// must not re-scan the subtree (that was the per-resize O(DOM) cost)
ok(typeof ed.observer.cb === 'function', 'P3 setup: the editor owns a drivable ResizeObserver')
bd1.size = [0, 0]
reset()
walks = countNcidReads(() => ed.observer.cb([roEntry(bd1.el, 120, 90)]))
ok(bd1.size[0] === 120, 'P3-1 the block size was still updated by the resize handler')
ok(walks === 0, `P3-1 a block resize walks ZERO elements (${walks})`)
ok(moves.length === 0, 'P3-2 a resize that moved nothing reports nothing')

// a connector element added to the DOM IS picked up on its own
reset()
const extra = document.createElement('b')
extra.setAttribute('ncid', 'o9')
extra.setAttribute('ne-connect', 'out')
bd1.el.querySelector('.ne-content').appendChild(extra)
await tick(0)
ok(ed.getConnector('1/o9') != null, 'P3-1 a connector added to the DOM is discovered automatically')
ok(ed.getConnector('1/o9').root === bd1, 'P3-1 the new connector belongs to its block')
ok(bd1.structDirty === false && bd1.resizeSet.has(extra), 'P3-1 the rescan installed the new resizeSet')
ok(countNcidReads(() => ed.recheckConnectors(bd1)) === 0, 'P3-1 the block is memoized again after that rescan')
const perBlockNow = bd1.connectorMap.size

// ---------- P3-2: batched ne-move ----------
const con11 = ed.getConnector('1/o1')
con11.el.addEventListener('ne-move', () => legacyConEvents++)
const line = ed.lines[0]
const endpointBefore = line.p1.pos[0]

reset()
ed.setPos('1', [1000, 500])
ok(moves.length === 0, 'P3-2 no ne-move is dispatched synchronously (it is queued)')
await tick(0)
ok(moves.length === 1, 'P3-2 ONE batched ne-move for the whole task')
const batch = moves[0]
ok(
  Array.isArray(batch.connectors) && batch.connectors.length === perBlockNow,
  'P3-2 detail.connectors lists every moved connector',
)
ok(
  batch.connectors.some(c => c.idFull === '1/o9' && c.id === 'o9' && c.pos[0] === 1000),
  'P3-2 the entries keep the old per-connector detail shape',
)
ok(
  batch.connectors.every(c => c.movedStamp === batch.stamp),
  'P3-2 every entry carries the batch stamp',
)
ok(batch.stamp === con11.movedStamp, 'P3-2 the live connector is stamped (O(1) membership for listeners)')
ok(legacyConEvents === 0, 'P3-2 the per-element event is replaced by the batch')
ok(line.p1.pos[0] === 1000 && endpointBefore !== line.p1.pos[0], 'P3-2 the attached line followed its endpoint')

// a single connector's own resize: one event with exactly that connector
reset()
walks = countNcidReads(() => ed.observer.cb([roEntry(con11.el, 12, 6)]))
await tick(0)
ok(
  moves.length === 1 && moves[0].connectors.length === 1 && moves[0].connectors[0].idFull === '1/o1',
  'P3-2 a single connector resize batches to one event with one entry',
)
ok(walks === 0 && con11.size[0] === 12, 'P3-1 the connector resize did not re-scan the block')

// a whole-canvas pan is ONE event, not one per connector
reset()
ed.moveAll(10, 10)
ed.fireMoveDone(bd1)
ok(moves.length === 1, 'P3-2 moveAll over 200 blocks is a single ne-move')
ok(
  moves[0].connectors.length === conTotal + 1 && moves[0].connectors.every(c => c.pos && c.idFull),
  `P3-2 the batch reported all ${conTotal + 1} connectors`,
)
ok(doneEvents.length === 1 && doneEvents[0].nid === '1', 'P3-2 block-level ne-move-done detail is unchanged')
ok(
  order[0] === 'ne-move' && order[1] === 'ne-move-done',
  'P3-2 the connector batch is reported BEFORE ne-move-done (' + order.join(',') + ')',
)
await tick(0)
ok(moves.length === 1, 'P3-2 the flush is not duplicated when the microtask runs')

// ---------- P3-3: selection of a big graph ----------
ed.selectAll()
ok(ed.selectedBlocks.length === N, 'P3-3 selectAll selects every block')
// Selection is carried by the `selected` attribute, NOT by the accessible name (the aria-label used
// to grow a " selected" suffix, which made a block announce itself as a different element on click).
ok(
  ed.blocks.every(b => b.el.getAttribute('selected') === 'selected'),
  'P3-3 every block got the selected state',
)
ed.selectBlocks([ed.getBlockData('7')])
ok(
  ed.getBlockData('7').el.getAttribute('selected') === 'selected' &&
    ed.getBlockData('8').el.getAttribute('selected') === null,
  'P3-3 selection membership is exact',
)

// ---------- P3-4: cached menu box + synchronous repositioning ----------
const groupMenu = mkMenu()[0]
ed.menuGenerator = () => groupMenu
ed.selectBlocks([bd1])
let measures = 0
let fakeZoom = 1
groupMenu.getBoundingClientRect = () => {
  measures++
  // a menu inside the scaled content area measures its size TIMES the zoom
  return { width: 100 * fakeZoom, height: 20 * fakeZoom, x: 0, y: 0 }
}
bd1.size = [100, 80]
// the menu position is published as CSS variables (`--ne-menu-x` / `--ne-menu-y`); nodditor.css
// turns them into left/top. Nothing is written inline any more.
const menuX = () => groupMenu.style.getPropertyValue('--ne-menu-x')
const menuY = () => groupMenu.style.getPropertyValue('--ne-menu-y')
moveMenu([bd1], groupMenu, 1)
ok(
  menuX() === bd1.pos[0] + 50 - 50 + 'px' && menuY() === bd1.pos[1] - 20 + 'px',
  `P3-4 menu centered over the block (${menuX()},${menuY()})`,
)
moveMenu([bd1], groupMenu, 1)
moveMenu([bd1], groupMenu, 1)
ok(measures === 1, `P3-4 the menu box is measured once for 3 placements (${measures})`)
groupMenu.appendChild(document.createElement('div'))
await tick(0)
moveMenu([bd1], groupMenu, 1)
ok(measures === 2, 'P3-4 a content change invalidates the cached box')

// the cache is stored UNSCALED: zooming in grows the rendered box but must not
// move the menu (block coordinates are unscaled content coordinates)
const leftZoomed = menuX()
const topZoomed = menuY()
fakeZoom = 2
moveMenu([bd1], groupMenu, 2)
ok(measures === 2, 'P3-4 zooming does not force a re-measure')
ok(menuX() === leftZoomed && menuY() === topZoomed, 'P3-4 the cached box is zoom-independent')
groupMenu._neMenuSize = null
moveMenu([bd1], groupMenu, 2)
ok(
  measures === 3 && menuX() === leftZoomed && menuY() === topZoomed,
  'P3-4 a fresh measure at zoom 2 normalizes to the same box',
)

const bd2 = ed.getBlockData('2')
bd2.size = [100, 80]
ed.selectBlocks([bd1, bd2])
ed.currentMenu = groupMenu
// hide it and park it somewhere wrong, the way a drag start does (via `setVisible`, not inline style)
groupMenu.setAttribute('hidden', 'hidden')
groupMenu.style.setProperty('--ne-menu-x', '-999px')
ed.setPos('1', [300, 400])
reset()
ed.fireMoveDone(ed.getBlockData('1'))
const bx = ed.getBlockData('1')
const groupLeft =
  Math.min(bx.pos[0], bd2.pos[0]) +
  (Math.max(bx.pos[0] + 100, bd2.pos[0] + 100) - Math.min(bx.pos[0], bd2.pos[0])) / 2 -
  50
ok(!groupMenu.hasAttribute('hidden'), 'P3-4 fireMoveDone re-shows the menu')
ok(menuX() === groupLeft + 'px', `P3-4 fireMoveDone repositions synchronously (left=${menuX()}, want ${groupLeft}px)`)
ok(measures === 3, 'P3-4 the repositioning reused the cached box (no extra measure)')

// no inline style manipulation: the menu carries only CSS custom properties
ok(
  !/\b(left|top|display|position)\s*:/.test(groupMenu.getAttribute('style') || ''),
  `P3-4 the menu carries no layout/visibility inline style (${groupMenu.getAttribute('style')})`,
)

// ---------- P3-5: connect-drag hit test is coalesced ----------
let hits = 0
document.elementFromPoint = (x, y) => {
  hits++
  // the "in" connector of block 3 is the only drop target the stub resolves
  return x === 42 && y === 42 ? ed.getConnector('3/i1').el : null
}
const src = ed.getConnector('1/o3').el
src.setPointerCapture = () => {}
src.releasePointerCapture = () => {}
const fire = (el, type, props = {}) => {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX: 0, clientY: 0, pointerId: 7, button: 0 }, props)
  el.dispatchEvent(e)
}
const linesBefore = ed.lines.length
fire(src, 'pointerdown')
for (let i = 0; i < 6; i++) fire(src, 'pointermove', { clientX: 1, clientY: 1 })
ok(hits === 0, 'P3-5 the 6 pointer events of this frame did no hit test yet')
await tick()
ok(hits === 1, `P3-5 ONE elementFromPoint per frame (${hits})`)
fire(src, 'pointermove', { clientX: 42, clientY: 42 })
fire(src, 'pointerup')
ok(hits === 2, 'P3-5 the pending position is resolved on release (no lost connect)')
ok(ed.lines.length === linesBefore + 1, 'P3-5 the drag still produced a line')
ok(ed.lineExists('1/o3', '3/i1'), 'P3-5 the new line connects the dragged pair')

// ---------- stress: 60 pan frames of the 200 block graph ----------
reset()
const x200 = ed.getBlockData('200').pos[0]
const t0 = performance.now()
for (let f = 0; f < 60; f++) {
  ed.moveAll(2, 1)
  await tick(0)
}
const ms = performance.now() - t0
ok(moves.length === 60, `stress: 60 pan frames produced ${moves.length} ne-move events, not 60×${conTotal}`)
ok(
  moves.every(d => d.connectors.length === conTotal + 1),
  'stress: every frame reported the whole moved canvas',
)
ok(ms < 8000, `stress: 60 frames of ${N} blocks took ${ms.toFixed(0)}ms`)
ok(
  ed.getBlockData('200').pos[0] === x200 + 120,
  `stress: positions accumulated correctly (${ed.getBlockData('200').pos[0]})`,
)

Element.prototype.getAttribute = origGetAttr
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL SMOKE ASSERTIONS PASSED')
process.exitCode = failures ? 1 : 0
