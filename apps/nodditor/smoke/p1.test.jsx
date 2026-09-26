/**
 * P1 smoke test — runs the real editor under happy-dom (register the DOM
 * globals and stub IntersectionObserver BEFORE importing this file; see
 * p1.run.mjs). Asserts the Task P1 behaviors:
 *
 *  P1-1 duplicate block id throws
 *  P1-2 addConnectorFromTo rejects unknown / self / duplicate pairs; lineExists
 *  P1-3 removeConnector is idempotent and cleans orphan lines; removeBlock
 *       removes connected lines and clears connectorMap
 *  P1-4 destroy()/disconnectedCallback
 *  P1-5 lineinteraction aliases lineinteraciton (get + set)
 *  P1-6 saveGraph/loadGraph round-trip with typeMap factories
 *  P1-7 Delete-key guard while a contenteditable is focused
 *  P1-7b EditableTitle pointerup/Enter/Escape/blur lifecycle
 */
import { EditableTitle } from '../src/EditableTitle.js'
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
const throws = (fn, msg, re) => {
  try {
    fn()
    ok(false, msg + ' (did not throw)')
  } catch (e) {
    ok(re.test(e.message), msg + ' -> ' + e.message)
  }
}

const editor = new NodeEditor()
document.body.appendChild(editor)

// ---------- P1-1: duplicate block id ----------
editor.add(<Switch />, '1', { type: 'Switch' })
editor.add(<Switch />, '2', { type: 'Switch' })
editor.add(<Message />, '3', { type: 'Message' })
throws(() => editor.add(<Switch />, '1'), 'P1-1 duplicate id throws', /already in use/)
ok(editor.blocks.length === 3, 'P1-1 valid ids still added (3 blocks)')

// ---------- P1-2: connector validation ----------
throws(() => editor.addConnectorFromTo('1/o1', 'no/such'), 'P1-2 unknown connector throws', /unknown connector/)
throws(() => editor.addConnectorFromTo('1/o1', '1/o1'), 'P1-2 self-connect throws', /itself/)
editor.addConnectorFromTo('1/o1', '2/i1')
ok(editor.lines.length === 1, 'P1-2 valid pair accepted (1 line)')
throws(() => editor.addConnectorFromTo('1/o1', '2/i1'), 'P1-2 duplicate pair throws', /already connected/)
throws(() => editor.addConnectorFromTo('2/i1', '1/o1'), 'P1-2 reversed duplicate throws', /already connected/)
ok(editor.lineExists('1/o1', '2/i1') === true, 'P1-2 lineExists true for connected pair')
ok(editor.lineExists('1/o2', '2/i1') === false, 'P1-2 lineExists false for free pair')
editor.addConnectorFromTo('1/o2', '3/i1')
ok(editor.lines.length === 2, 'P1-2 second valid line accepted')

// ---------- P1-3: connector cleanup ----------
const con11 = editor.getConnector('1/o1')
let neRemoveCount = 0
con11.el.addEventListener('ne-remove', () => neRemoveCount++)
editor.removeConnector(con11)
ok(editor.getConnector('1/o1') == null, 'P1-3 connector dropped from connectorMap')
ok(editor.lines.length === 1, 'P1-3 line attached to removed connector is gone (no orphan)')
ok(neRemoveCount === 1, 'P1-3 ne-remove fired exactly once')
editor.removeConnector(con11)
ok(neRemoveCount === 1 && editor.lines.length === 1, 'P1-3 removeConnector is idempotent')
const block3 = editor.getBlockData('3')
editor.removeBlock(block3)
ok(editor.lines.length === 0, 'P1-3 removeBlock removes connected lines')
ok(block3.connectorMap.size === 0, 'P1-3 removeBlock clears connectorMap')
ok(typeof con11.el.removeObserve === 'function', 'P1-3 connector el carries removeObserve (IO wiring)')

// ---------- P1-6: saveGraph / loadGraph ----------
editor.addConnectorFromTo('1/o3', '2/i1')
const el1Before = editor.getBlockData('1').el
const state = JSON.parse(JSON.stringify(editor.saveGraph()))
ok(
  state.blocks.length === 2 && state.blocks.every(b => b.type && b.id && b.pos),
  'P1-6 saveGraph serializes blocks with id/type/pos',
)
ok(
  state.lines.length === 1 && state.lines[0][0] === '1/o3' && state.lines[0][1] === '2/i1',
  'P1-6 saveGraph serializes line idFull pairs',
)

const typeMap = {
  Switch: () => <Switch />,
  Message: () => <Message />,
}
state.blocks[0].pos = [123, 45]
editor.loadGraph(state, typeMap)
ok(editor.blocks.length === 2 && editor.lines.length === 1, 'P1-6 loadGraph restores blocks + line')
ok(editor.getBlockData('1').el !== el1Before, 'P1-6 typeMap factory produced a FRESH element')
ok(JSON.stringify(editor.getPos('1')) === '[123,45]', 'P1-6 loadGraph restores positions')
ok(editor.getConnector('1/o3') != null && editor.lineExists('1/o3', '2/i1'), 'P1-6 loadGraph reconnects line')
throws(
  () => editor.loadGraph({ blocks: [{ id: 'x', type: 'Nope', pos: [0, 0] }], lines: [] }, typeMap),
  'P1-6 missing factory throws',
  /no factory registered/,
)
throws(() => editor.loadGraph(state, {}), 'P1-6 empty typeMap throws', /no factory registered/)
editor.loadGraph(state, typeMap)

// ---------- P1-7: Delete-key guard ----------
editor.selectBlocks([editor.getBlockData('1')])
editor.dispatchEvent(new Event('focus')) // -> $s.hasFocus
const ce = document.createElement('div')
ce.contentEditable = 'true'
// happy-dom never fills isContentEditable (browsers reflect the contenteditable
// attribute) — emulate it locally so the guard sees the same value as in a browser
Object.defineProperty(ce, 'isContentEditable', { get: () => true, configurable: true })
document.body.appendChild(ce)
ce.focus()
ok(document.activeElement === ce, 'P1-7 setup: contenteditable element focused')
const blocksBeforeDelete = editor.blocks.length
editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
ok(editor.blocks.length === blocksBeforeDelete, 'P1-7 Delete while editing title deletes nothing')
ce.blur()
editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
ok(editor.blocks.length === blocksBeforeDelete - 1, 'P1-7 Delete with selection removes the block')

// ---------- P1-7b: EditableTitle lifecycle ----------
const title = EditableTitle({ onchange: () => {} })
document.body.appendChild(title)
// happy-dom does not reflect the contenteditable attribute to isContentEditable —
// emulate the browser reflection locally
Object.defineProperty(title, 'isContentEditable', {
  get: () => title.getAttribute('contenteditable') === 'true',
  configurable: true,
})
let changes = 0
title.addEventListener('change', () => changes++)
title.setValue('Hello')
title.dispatchEvent(new Event('pointerup'))
ok(title.getAttribute('contenteditable') === 'true', 'ET pointerup enables editing')
title.textContent = 'Changed'
title.dispatchEvent(new Event('blur'))
ok(title.getAttribute('contenteditable') === null, 'ET blur ends editing')
ok(changes === 1, 'ET blur fires change once')
title.dispatchEvent(new Event('pointerup'))
title.textContent = 'Typing'
title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
ok(title.textContent === 'Changed', 'ET Escape restores old text')
ok(title.getAttribute('contenteditable') === null, 'ET Escape ends editing')
ok(changes === 1, 'ET Escape fires no change')
title.dispatchEvent(new Event('pointerup'))
title.textContent = 'Entered'
title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
ok(changes === 2 && title.getAttribute('contenteditable') === null, 'ET Enter commits and ends editing')
title.dispatchEvent(new Event('blur'))
ok(changes === 2, 'ET blur after commit fires no extra change')
title.textContent = 'Same'
title.dispatchEvent(new Event('pointerup'))
title.dispatchEvent(new Event('blur'))
ok(changes === 2, 'ET blur without edit fires no change')

// ---------- P1-5: lineinteraction alias ----------
ok(editor.lineinteraction === editor.lineinteraciton, 'P1-5 getter aliases lineinteraciton')
const li = editor.lineinteraciton
editor.lineinteraction = null
ok(editor.lineinteraciton === null, 'P1-5 setter writes through')
editor.lineinteraction = li
ok(editor.lineinteraciton === li, 'P1-5 alias restored')

// ---------- P1-4: destroy + disconnectedCallback ----------
const e2 = new NodeEditor()
document.body.appendChild(e2)
e2.add(<Switch />, 'a', { type: 'Switch' })
e2.add(<Switch />, 'b', { type: 'Switch' })
e2.addConnectorFromTo('a/o1', 'b/i1')
e2.destroy()
ok(e2.blocks.length === 0 && e2.lines.length === 0, 'P1-4 destroy empties blocks and lines')
ok(e2.destroyed === true, 'P1-4 destroyed flag set')
e2.destroy() // idempotent — must not throw
ok(e2.blocks.length === 0 && e2.lines.length === 0, 'P1-4 second destroy is a no-op')

const e3 = new NodeEditor()
document.body.appendChild(e3)
e3.add(<Switch />, 'c', { type: 'Switch' })
e3.add(<Switch />, 'd', { type: 'Switch' })
e3.addConnectorFromTo('c/o1', 'd/i1')
e3.remove() // detached from the DOM -> disconnectedCallback -> destroy()
ok(e3.destroyed === true, 'P1-4 disconnecting the element destroys the editor')
ok(e3.blocks.length === 0 && e3.lines.length === 0, 'P1-4 disconnect cleaned blocks/lines')

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL SMOKE ASSERTIONS PASSED')
process.exitCode = failures ? 1 : 0
