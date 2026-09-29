/**
 * DOM-level tests for the nodditor data model, driven through the real editor under happy-dom
 * (see `setup.js`, which every assertion here depends on).
 *
 * Covered:
 *  - `NodeEditor.add` (block data, duplicate-id rejection, DOM wiring)
 *  - `getConnector` in all three accepted forms (`"id/ncid"`, `[id, ncid]`, `(id, ncid)`)
 *  - `addConnectorFromTo` (P1-2 duplicate rejection, in both directions) and `lineExists`
 *  - `selectBlocks` (menu visibility, selected state, aria label/status)
 *  - Delete/Backspace (removes the selected line, then the selected blocks; guarded while an
 *    in-place title is focused)
 */
import './setup.js'

import { afterEach, beforeEach, expect, test } from 'bun:test'

import { NodeEditor } from '../src/NodeEditor.jsx'
import { Message } from '../src/blocks/Message.js'
import { Switch } from '../src/blocks/Switch.js'

const typeMap = { Switch: () => <Switch />, Message: () => <Message /> }

/** @type {NodeEditor} */
let editor
/** @type {ReturnType<typeof makeMenu>} */
let menu

/**
 * One menu element + the generator the editor calls for it. The generator returns the SAME
 * element every time, which is what makes "is the menu visible after selecting?" observable.
 */
function makeMenu() {
  const el = <div class="ne-menu"></div>
  return { el, generator: () => el }
}

beforeEach(() => {
  menu = makeMenu()
  editor = new NodeEditor({ menu: menu.generator, typeMap })
  document.body.appendChild(editor)
})

afterEach(() => {
  editor.destroy()
  editor.remove()
  document.body.innerHTML = ''
})

/** Build a small graph: two Switch blocks (4 connectors each) + one Message block. */
function addThreeBlocks() {
  const b1 = editor.add(<Switch />, '1', { type: 'Switch' })
  const b2 = editor.add(<Switch />, '2', { type: 'Switch' })
  const b3 = editor.add(<Message />, '3', { type: 'Message' })
  return { b1, b2, b3 }
}

// ---------- add ----------

test('add: registers block data and the DOM element', () => {
  const block = editor.add(<Switch />, 'a1', { pos: [30, 40], type: 'Switch' })

  expect(editor.blocks.length).toBe(1)
  expect(editor.getBlockData('a1')).toBe(block)
  expect(block.id).toBe('a1')
  expect(block.type).toBe('Switch')
  // pos is applied through `_setPos` as the `--ne-x`/`--ne-y` custom properties; `.ne-block` in
  // static/nodditor.css turns them into the block transform
  expect(block.pos).toEqual([30, 40])
  expect(block.el.style.getPropertyValue('--ne-x')).toBe('30px')
  expect(block.el.style.getPropertyValue('--ne-y')).toBe('40px')
  expect(block.el.getAttribute('nid')).toBe('a1')
  expect(block.el.neBlock).toBe(block)
  expect(block.el.parentNode).toBe(editor.contentArea)
})

test('add: discovers the block connectors with their direction and owner', () => {
  const block = editor.add(<Switch />, 'a1', { type: 'Switch' })

  expect([...block.connectorMap.keys()]).toEqual(['i1', 'o1', 'o2', 'o3'])
  const out = editor.getConnector('a1/o1')
  expect(out.id).toBe('o1')
  expect(out.idFull).toBe('a1/o1')
  expect(out.dir).toBe('out')
  expect(out.root).toBe(block)
  expect(editor.getConnector('a1/i1').dir).toBe('in')
})

test('add: a duplicate block id throws and changes nothing', () => {
  editor.add(<Switch />, 'a1')
  expect(() => editor.add(<Switch />, 'a1')).toThrow(/already in use/)
  expect(editor.blocks.length).toBe(1)
})

test('add: ids are freed again by removeBlock', () => {
  const block = editor.add(<Switch />, 'a1')
  editor.removeBlock(block)
  expect(editor.add(<Switch />, 'a1').id).toBe('a1')
})

// ---------- getConnector ----------

test('getConnector: accepts "id/ncid", [id, ncid] and (id, ncid)', () => {
  addThreeBlocks()

  const byString = editor.getConnector('1/o2')
  expect(byString).toBe(editor.getConnector('1', 'o2'))
  expect(byString).toBe(editor.getConnector(['1', 'o2']))
  expect(byString.idFull).toBe('1/o2')
})

test('getConnector: unknown block or connector id is undefined, not a throw', () => {
  addThreeBlocks()
  expect(editor.getConnector('1/nope')).toBeUndefined()
  expect(editor.getConnector('nope/o1')).toBeUndefined()
  expect(editor.getConnector('nope')).toBeUndefined()
})

// ---------- addConnectorFromTo ----------

test('addConnectorFromTo: connects two connectors and wires both endpoints', () => {
  addThreeBlocks()

  const line = editor.addConnectorFromTo('1/o1', '2/i1')

  expect(editor.lines).toEqual([line])
  expect(line.p1.con).toBe(editor.getConnector('1/o1'))
  expect(line.p2.con).toBe(editor.getConnector('2/i1'))
  expect(line.el.parentNode).toBe(editor.svgLayer)
  expect(editor.lineExists('1/o1', '2/i1')).toBe(true)
})

test('addConnectorFromTo: accepts the array form of a connector id', () => {
  addThreeBlocks()
  const line = editor.addConnectorFromTo(['1', 'o2'], ['3', 'i1'])
  expect(line.p1.con.idFull).toBe('1/o2')
  expect(line.p2.con.idFull).toBe('3/i1')
})

test('addConnectorFromTo: rejects a duplicate pair in both directions (P1-2)', () => {
  addThreeBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')

  expect(() => editor.addConnectorFromTo('1/o1', '2/i1')).toThrow(/already connected/)
  expect(() => editor.addConnectorFromTo('2/i1', '1/o1')).toThrow(/already connected/)
  expect(editor.lines.length).toBe(1)
})

test('addConnectorFromTo: rejects unknown connectors and self-connection (P1-2)', () => {
  addThreeBlocks()

  expect(() => editor.addConnectorFromTo('1/o1', 'nope/i1')).toThrow(/unknown connector/)
  expect(() => editor.addConnectorFromTo('nope/o1', '1/i1')).toThrow(/unknown connector/)
  expect(() => editor.addConnectorFromTo('1/o1', '1/o1')).toThrow(/itself/)
  expect(editor.lines.length).toBe(0)
})

test('addConnectorFromTo: the same target connector accepts several sources', () => {
  addThreeBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')
  editor.addConnectorFromTo('1/o3', '2/i1')
  expect(editor.lines.length).toBe(2)
})

// ---------- selectBlocks ----------

test('selectBlocks: sets the selection, the menu and the block state', () => {
  const { b1, b2 } = addThreeBlocks()
  editor.selectBlocks([b1])

  expect(editor.selectedBlocks).toEqual([b1])
  expect(editor.currentMenu).toBe(menu.el)
  expect(menu.el.hasAttribute('hidden')).toBe(false)
  expect(b1.el.getAttribute('selected')).toBe('selected')
  // the accessible name is type + id and must NOT carry selection state
  expect(b1.el.getAttribute('aria-label')).toBe('Switch 1')
  expect(b2.el.getAttribute('selected')).toBeNull()
  // no selection-status text is injected into the editor
  expect(editor.statusEl).toBeUndefined()
})

test('selectBlocks: reports a multi-block selection', () => {
  const { b1, b2 } = addThreeBlocks()
  editor.selectBlocks([b1, b2])

  expect(editor.selectedBlocks.length).toBe(2)
  expect(b1.el.getAttribute('selected')).toBe('selected')
  expect(b2.el.getAttribute('selected')).toBe('selected')
  expect(b1.el.getAttribute('aria-label')).toBe('Switch 1')
})

test('selectBlocks: an empty list clears the selection and hides the menu', () => {
  const { b1 } = addThreeBlocks()
  editor.selectBlocks([b1])
  editor.selectBlocks([])

  expect(editor.selectedBlocks).toEqual([])
  expect(editor.currentMenu).toBeUndefined()
  expect(menu.el.getAttribute('hidden')).toBe('hidden')
  expect(b1.el.getAttribute('selected')).toBeNull()
})

test('selectBlocks: deselect() also drops a selected line', () => {
  addThreeBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')
  editor.selectConnector(line)
  expect(editor.selectedLine).toBe(line)

  editor.deselect()
  expect(editor.selectedLine).toBeUndefined()
  expect(editor.selectedBlocks).toEqual([])
})

// ---------- Delete key ----------

test('Delete: removes the selected line', () => {
  addThreeBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')
  editor.selectConnector(line)
  editor.dispatchEvent(new FocusEvent('focusin'))

  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))

  expect(editor.lines.length).toBe(0)
  expect(editor.selectedLine).toBeNull()
  expect(line.el.parentNode).toBeNull()
  expect(editor.blocks.length).toBe(3) // only the line went away
})

test('Delete: removes every selected block, but only the selected ones', () => {
  const { b1, b2 } = addThreeBlocks()
  editor.selectBlocks([b1, b2])
  editor.dispatchEvent(new FocusEvent('focusin'))

  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))

  expect(editor.blocks.length).toBe(1)
  expect(editor.getBlockData('3')).toBeDefined()
  expect(editor.getBlockData('1')).toBeUndefined()
  expect(editor.getBlockData('2')).toBeUndefined()
  expect(editor.selectedBlocks).toEqual([])
  expect(b1.el.parentNode).toBeNull()
})

test('Backspace: behaves like Delete', () => {
  const { b1 } = addThreeBlocks()
  editor.selectBlocks([b1])
  editor.dispatchEvent(new FocusEvent('focusin'))

  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }))

  expect(editor.blocks.length).toBe(2)
  expect(editor.getBlockData('1')).toBeUndefined()
})

test('Delete: deleting a block also removes its connected lines', () => {
  const { b1 } = addThreeBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')
  editor.selectBlocks([b1])
  editor.dispatchEvent(new FocusEvent('focusin'))

  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))

  expect(editor.lines.length).toBe(0)
})

test('Delete: ignored while an in-place title has focus (P1-7 guard)', () => {
  const { b1 } = addThreeBlocks()
  const title = b1.el.querySelector('.EditableTitle')
  // happy-dom never fills `isContentEditable` in (browsers reflect the contenteditable
  // attribute), so emulate the browser value the guard reads
  Object.defineProperty(title, 'isContentEditable', {
    get: () => title.getAttribute('contenteditable') === 'true',
    configurable: true,
  })
  title.setAttribute('contenteditable', 'true')
  title.focus()
  expect(document.activeElement).toBe(title)
  expect(document.activeElement.isContentEditable).toBe(true)

  editor.selectBlocks([b1])
  editor.dispatchEvent(new FocusEvent('focusin'))
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))

  // the keydown was typing, not deleting
  expect(editor.blocks.length).toBe(3)
  expect(editor.getBlockData('1')).toBeDefined()
  title.removeAttribute('contenteditable')
})

test('Delete: nothing selected means nothing happens', () => {
  addThreeBlocks()
  editor.dispatchEvent(new FocusEvent('focusin'))

  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))

  expect(editor.blocks.length).toBe(3)
  expect(editor.lines.length).toBe(0)
})
