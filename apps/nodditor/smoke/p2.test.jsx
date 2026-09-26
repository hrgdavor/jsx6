/**
 * P2 smoke test — runs the real editor under happy-dom (globals registered
 * and IntersectionObserver stubbed by p2.run.mjs BEFORE this module loads).
 * Asserts the Task P2 behaviors:
 *
 *  P2-1 multi-select: click select, Shift/Ctrl+click toggle, marquee on the
 *       empty canvas (plain + additive), menu centered over the group
 *  P2-2 keyboard: arrow nudge (Shift coarse), Ctrl+A, Esc
 *  P2-3 undo/redo: nudges, structural add/delete, line add — via the P1
 *       saveGraph/loadGraph serialization (Ctrl+Z / Ctrl+Shift+Z wiring)
 *  P2-4 zoom beyond 100%, min/max (default 0.3–4 + tpl config), indicator UI,
 *       zoom control buttons
 *  P2-5 grid snapping in nudge (the drag path applies the same snap rule)
 *  P2-6 right-click context menu on blocks and lines, positioned at cursor
 *  P2-7 accessibility: roles/labels, aria-live status, keyboard-only flow
 *
 * NOTE: undo/redo rebuilds ALL blocks (loadGraph), so BlockData/el references
 * go stale after an undo — re-fetch with getBlockData. Sections after the
 * undo tests use a fresh editor (ed3) to stay independent.
 */
import { NodeEditor } from '../src/NodeEditor.jsx'
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
const near = (a, b) => Math.abs(a - b) < 1e-9

// a pointer-like event with client coords (happy-dom Event instances are writable)
const pev = (target, type, props = {}) => {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX: 0, clientY: 0, pointerId: 1, button: 0 }, props)
  target.dispatchEvent(e)
  return e
}
const key = (target, k, mods = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods })
  target.dispatchEvent(e)
  return e
}
const ctx = (target, x, y) => {
  const e = new Event('contextmenu', { bubbles: true, cancelable: true })
  Object.assign(e, { clientX: x, clientY: y, button: 2 })
  target.dispatchEvent(e)
  return e
}

const typeMap = { Switch: () => <Switch />, Message: () => <Message /> }
const mkMenu = () => {
  const el = <div class="ne-menu"></div>
  return [el, () => el]
}

const graph0 = {
  blocks: [
    { id: '1', type: 'Switch', pos: [0, 0] },
    { id: '2', type: 'Switch', pos: [50, 50] },
    { id: '3', type: 'Message', pos: [400, 400] },
  ],
  lines: [
    ['1/o1', '2/i1'],
    ['2/o1', '3/i1'],
  ],
}

const [menuEl, menuFn] = mkMenu()
const ed = new NodeEditor({ menu: menuFn, typeMap })
document.body.appendChild(ed)
// happy-dom has no pointer capture and no layout: stub capture, fake block sizes
const ca = ed.contentArea
ca.setPointerCapture = () => {}
ca.releasePointerCapture = () => {}

ed.loadGraph(graph0, typeMap)
ed.blocks.forEach(b => (b.size = [100, 80])) // fake layout for marquee math
const selIds = () => ed.selectedBlocks.map(b => b.id).join(',')
ok(ed.blocks.length === 3 && ed.lines.length === 2, 'P2 setup: 3 blocks + 2 lines via loadGraph')
ok(ed.undoStack.length === 0 && ed.redoStack.length === 0, 'P2-3 loadGraph resets the history baseline')

// ---------- P2-1: click select + multi-select toggle ----------
const title = id => ed.getBlockData(id).el.querySelector('.ne-title')
pev(title('1'), 'pointerdown')
pev(title('1'), 'pointerup')
ok(selIds() === '1', 'P2-1 plain click selects one block')
pev(title('2'), 'pointerdown')
pev(title('2'), 'pointerup', { ctrlKey: true })
ok(selIds() === '1,2', 'P2-1 Ctrl+click toggles a second block into the selection')
ok(ed.currentMenu === menuEl && menuEl.style.left === '75px', 'P2-1 menu centered over the group (75px)')
ok(!menuEl.hasAttribute('hidden') && menuEl.style.display === '', 'P2-1 group menu visible')
pev(title('1'), 'pointerdown')
pev(title('1'), 'pointerup', { shiftKey: true })
ok(selIds() === '2', 'P2-1 Shift+click toggles the first block off')
pev(ca, 'pointerdown')
pev(ca, 'pointerup')
ok(selIds() === '', 'P2-1 click on empty canvas deselects')

// ---------- P2-1: marquee ----------
pev(ca, 'pointerdown', { clientX: -10, clientY: -10 })
pev(ca, 'pointermove', { clientX: 160, clientY: 160 })
ok(ca.querySelector('.ne-marquee'), 'P2-1 marquee rectangle shown while dragging on empty canvas')
pev(ca, 'pointerup', { clientX: 160, clientY: 160 })
ok(!ca.querySelector('.ne-marquee'), 'P2-1 marquee removed on release')
ok(selIds() === '1,2', 'P2-1 marquee selects intersecting blocks only (not block 3)')
pev(ca, 'pointerdown')
pev(ca, 'pointermove', { clientX: 300, clientY: 300 })
pev(ca, 'pointerup', { clientX: 560, clientY: 560, shiftKey: true })
ok(selIds() === '1,2,3', 'P2-1 Shift+marquee adds to the selection')
key(ed, 'Escape')
ok(selIds() === '' && !ed.selectedLine, 'P2-2 Esc deselects everything')

// right-button pointerdown/up must not disturb the selection (context menu does)
const selBeforeRight = selIds()
pev(ca, 'pointerdown', { button: 2 })
pev(ca, 'pointerup', { button: 2 })
ok(selIds() === selBeforeRight, 'P2-6 right pointerdown/up does not change the selection')

// ---------- P2-2/P2-3: nudge + undo/redo of it ----------
ed.dispatchEvent(new Event('focus'))
const pos0 = JSON.stringify(ed.getPos('1'))
ed.selectBlocks([ed.getBlockData('1')])
const eRight = key(ed, 'ArrowRight')
ok(eRight.defaultPrevented, 'P2-2 arrows preventDefault (no page scroll)')
ok(JSON.stringify(ed.getPos('1')) === '[10,0]', 'P2-2 ArrowRight nudges by nudgeStep (10)')
key(ed, 'ArrowUp', { shiftKey: true })
ok(JSON.stringify(ed.getPos('1')) === '[10,-50]', 'P2-2 Shift+Arrow uses the coarse step (5x)')
key(ed, 'z', { ctrlKey: true })
ok(JSON.stringify(ed.getPos('1')) === pos0, 'P2-3 Ctrl+Z reverts both merged nudges')
key(ed, 'z', { ctrlKey: true, shiftKey: true })
ok(JSON.stringify(ed.getPos('1')) === '[10,-50]', 'P2-3 Ctrl+Shift+Z redoes the nudges')
key(ed, 'z', { ctrlKey: true })
ok(JSON.stringify(ed.getPos('1')) === pos0, 'P2-3 undo again restores the loaded positions')
ok(ed.statusEl.textContent === 'Undo', 'P2-7 aria-live announces undo')

// ---------- P2-3: structural undo/redo ----------
key(ed, 'a', { ctrlKey: true })
ok(ed.selectedBlocks.length === 3, 'P2-2 Ctrl+A selects all blocks')
ed.selectBlocks([ed.getBlockData('3')])
const el3 = ed.getBlockData('3').el
const lines0 = ed.lines.length
ed.deleteSelection()
ok(ed.blocks.length === 2 && ed.lines.length === 1, 'P2-3 deleteSelection removes block + its line')
ed.undo()
ok(ed.blocks.length === 3 && ed.lines.length === 2, 'P2-3 undo restores block + line')
ok(ed.getBlockData('3').el !== el3 && ed.lineExists('2/o1', '3/i1'), 'P2-3 undo rebuilds via typeMap factory')
ed.redo()
ok(ed.blocks.length === 2, 'P2-3 redo deletes again')
ed.undo()
ok(ed.blocks.length === 3, 'P2-3 undo back to 3 blocks')
ed.add(<Switch />, '9', { type: 'Switch', pos: [700, 700] })
ok(ed.blocks.length === 4, 'P2-3 add records history')
ed.undo()
ok(ed.blocks.length === 3 && !ed.getBlockData('9'), 'P2-3 undo removes the added block')
const l0 = ed.lines.length
ed.addConnectorFromTo('1/o2', '3/i1')
ok(ed.lines.length === l0 + 1, 'P2-3 addConnectorFromTo records history')
ed.undo()
ok(ed.lines.length === l0, 'P2-3 undo removes the added line')
ed.redo()
ok(ed.lines.length === l0 + 1 && ed.undo(), 'P2-3 redo re-adds the line')
ed.undo()
// an editor without typeMap cannot undo
const edNoMap = new NodeEditor()
document.body.appendChild(edNoMap)
edNoMap.add(<Switch />, 'a', { type: 'Switch' })
ok(edNoMap.undo() === false, 'P2-3 nothing to undo right after the first recorded change')
edNoMap.add(<Switch />, 'b', { type: 'Switch' })
ok(edNoMap.undo() === false && edNoMap.blocks.length === 2, 'P2-3 undo without typeMap is refused')

// ---------- P2-4: zoom past 100%, clamps, indicator, config ----------
ed.changeZoom(10, 50, 50)
ok(ed.zoom === 4, 'P2-4 wheel zoom can exceed 100% (clamped at default max 4)')
ok(ed.zoomLabel.textContent === '400%', 'P2-4 indicator shows 400%')
ok(ed.zoomUI.classList.contains('at-max'), 'P2-4 UI marks the max bound')
ed.zoomTo(0.01)
ok(ed.zoom === 0.3 && ed.zoomLabel.textContent === '30%', 'P2-4 min zoom 0.3 + indicator')
ok(ed.zoomUI.classList.contains('at-min'), 'P2-4 UI marks the min bound')
const plusBt = ed.zoomUI.children[2]
plusBt.dispatchEvent(new Event('click', { bubbles: true }))
ok(near(ed.zoom, 0.375), 'P2-4 zoom-in button (+25%) works')
ed.zoomTo(1)
key(ed, '=', { ctrlKey: true })
ok(near(ed.zoom, 1.25), 'P2-4 Ctrl+= zooms in past 100%')
key(ed, '0', { ctrlKey: true })
ok(near(ed.zoom, 1) && ed.zoomLabel.textContent === '100%', 'P2-4 Ctrl+0 resets to 100%')
const ed2 = new NodeEditor({ zoomMin: 0.5, zoomMax: 1.5 })
document.body.appendChild(ed2)
ed2.zoomTo(9)
ok(ed2.zoom === 1.5, 'P2-4 tpl zoomMax honored')
ed2.zoom = 0.1
ok(ed2.zoom === 0.5, 'P2-4 zoom setter clamps to tpl zoomMin')

// ---------- P2-5: grid snapping ----------
ed.snap = 20
ed.setPos(ed.getBlockData('1'), [27, 33])
ed.selectBlocks([ed.getBlockData('1')])
ed.nudgeSelection(1, 1)
ok(JSON.stringify(ed.getPos('1')) === '[20,40]', 'P2-5 snap aligns the nudged block to the grid')
ed.snap = 0
ed.setPos(ed.getBlockData('1'), [27, 33])
ed.nudgeSelection(1, 1)
ok(JSON.stringify(ed.getPos('1')) === '[28,34]', 'P2-5 snap=0 leaves moves unsnapped')

// ---------- P2-6/P2-7: fresh editor for context menu / a11y / keyboard-only ----------
const [menu3, menuFn3] = mkMenu()
const ed3 = new NodeEditor({ menu: menuFn3, typeMap })
document.body.appendChild(ed3)
ed3.contentArea.setPointerCapture = () => {}
ed3.contentArea.releasePointerCapture = () => {}
ed3.loadGraph(graph0, typeMap)
const sel3 = () => ed3.selectedBlocks.map(b => b.id).join(',')
const title3 = id => ed3.getBlockData(id).el.querySelector('.ne-title')

const cmBlock = ctx(title3('1'), 123, 45)
ok(cmBlock.defaultPrevented, 'P2-6 contextmenu prevented (no browser menu)')
ok(sel3() === '1', 'P2-6 right-click selects the block under the cursor')
ok(ed3.currentMenu === menu3 && !menu3.hasAttribute('hidden'), 'P2-6 menu shown for right-click')
ok(menu3.style.left === '123px' && menu3.style.top === '45px', 'P2-6 menu positioned at the cursor')
// keep a multi-selection when right-clicking inside it
pev(title3('2'), 'pointerdown')
pev(title3('2'), 'pointerup', { shiftKey: true })
ok(sel3() === '1,2', 'P2-6 setup: two blocks selected')
ctx(title3('2'), 200, 30)
ok(sel3() === '1,2' && menu3.style.left === '200px', 'P2-6 right-click inside the group keeps it selected')
const line = ed3.lines.find(l => l.p1.con?.idFull === '1/o1')
const cmLine = ctx(line.line2, 50, 60)
ok(cmLine.defaultPrevented && ed3.selectedLine === line, 'P2-6 right-click on a line selects it')
ok(ed3.currentMenu === menu3 && menu3.style.left === '50px', 'P2-6 menu opens at cursor for lines too')
ctx(ed3.contentArea, 5, 5)
ok(sel3() === '' && !ed3.selectedLine, 'P2-6 right-click on empty canvas deselects')

// roles, labels, live region
const bA = ed3.getBlockData('1')
ok(bA.el.getAttribute('role') === 'group' && bA.el.getAttribute('tabindex') === '0', 'P2-7 blocks are tabbable groups')
ed3.selectBlocks([bA, ed3.getBlockData('2')])
ok(/Switch 1/.test(bA.el.getAttribute('aria-label')), 'P2-7 block aria-label has type + id')
ok(ed3.statusEl.textContent === '2 blocks selected', 'P2-7 aria-live reports the multi-selection')
ed3.deselect()
ok(ed3.statusEl.textContent === 'selection cleared', 'P2-7 aria-live reports cleared selection')
ok(
  line.el.getAttribute('role') === 'img' && line.el.getAttribute('tabindex') === '0',
  'P2-7 lines are focusable images',
)
ok(/connection 1\/o1 -> 2\/i1/.test(line.el.getAttribute('aria-label')), 'P2-7 line aria-label from endpoints')
ed3.selectConnector(line)
ok(/connection .* selected/.test(ed3.statusEl.textContent), 'P2-7 aria-live reports line selection')
ed3.deselect()

// keyboard-only pass: focus block -> Enter -> arrows -> Delete -> undo
ed3.dispatchEvent(new Event('focus'))
const el1 = bA.el
key(el1, 'Enter')
ok(sel3() === '1', 'P2-7 Enter on the focused block selects it')
const y0 = ed3.getPos('1')[1]
key(el1, 'ArrowDown')
ok(ed3.getPos('1')[1] === y0 + 10, 'P2-7 ArrowDown works after keyboard-only selection')
const lines1 = ed3.lines.length
key(el1, 'Delete')
ok(ed3.getBlockData('1') == null && ed3.lines.length === lines1 - 1, 'P2-7 Delete removes the selected block + line')
ok(
  ed3.undo() && ed3.getBlockData('1') != null && ed3.lines.length === lines1,
  'P2-7 undo restores the keyboard-deleted block',
)

// ---------- P2-6: EditableTitle wiring (the "E" menu button flow) ----------
const el1again = ed3.getBlockData('1').el
const et = el1again.querySelector('.EditableTitle')
ok(!!et, 'P2-6 Switch title uses EditableTitle')
et.dispatchEvent(new Event('pointerup', { bubbles: true }))
ok(et.getAttribute('contenteditable') === 'true', 'P2-6 title becomes editable on pointerup (E-button flow)')

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL SMOKE ASSERTIONS PASSED')
process.exitCode = failures ? 1 : 0
