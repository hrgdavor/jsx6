/**
 * Runnable example: the smallest complete `@jsx6/nodditor` host — blocks, connectors, a line, and a
 * save/load round trip.
 *
 * The `demo` region is what `doc/getting-started.md` injects; everything outside it is the check that
 * keeps the sample honest. It needs a DOM and the JSX transform, so it runs through its runner:
 *
 *   cd apps/nodditor && node doc/getting-started.run.mjs
 *
 * The file is named `*.example.jsx` (not `*.test.jsx`) on purpose: the editor extends `HTMLElement` at
 * module-evaluation time, so the DOM globals have to exist before it is imported — the runner does that.
 */
import assert from 'node:assert/strict'

import { NodeEditor } from '../src/NodeEditor.jsx'

// #region demo
// A block is any component you hand to `add()`. The element it returns is the block root: the editor
// adds `nid`, the ARIA attributes and the transform, and finds the connectors by walking it.
function Switch({ id, label = 'Switch' }) {
  return (
    <div class="ne-block">
      <div class="ne-title" ne-drag ne-item>
        <b ncid="i1" ne-connect="in" />
        {label || id}
      </div>
      <div class="ne-content">
        <b ncid="o1" ne-connect="out" />
      </div>
    </div>
  )
}

// A factory per block type is what lets the editor rebuild a block from saved data — that is how
// `loadGraph`, undo and redo work. It receives the saved entry, so keep in it whatever you need.
const typeMap = {
  Switch: data => <Switch id={data.id} label={data.label} />,
}

const editor = new NodeEditor({
  typeMap,
  snap: 20, // round block moves to a 20px grid; 0 disables snapping
  style: 'width: 800px; height: 500px; contain: strict',
})
document.body.appendChild(editor)

editor.add(<Switch id="1" />, '1', { type: 'Switch', pos: [30, 10] })
editor.add(<Switch id="2" label="Second" />, '2', { type: 'Switch', pos: [30, 220], label: 'Second' })
editor.addConnectorFromTo('1/o1', '2/i1')
// #endregion demo

// ------------------------------------------------------------------------------------------------
// The demo above is deliberately small; the rest of this file pins the contract the page describes.
// ------------------------------------------------------------------------------------------------

// Connector discovery: the ids are `blockId/ncid`, and both the short and the split form resolve.
assert.equal(editor.getConnector('1', 'o1').idFull, '1/o1')
assert.equal(editor.getConnector('1/o1').idFull, '1/o1')
assert.equal(editor.getConnector(['2', 'i1']).dir, 'in')
assert.equal(editor.inspectConnectors().length, 4) // two blocks, one in + one out each
assert.ok(editor.lineExists('1/o1', '2/i1'))

// The editor owns the block root's accessibility and hit-testing attributes.
const block1 = editor.getBlockData('1')
assert.equal(block1.type, 'Switch')
assert.equal(block1.el.getAttribute('nid'), '1')
assert.equal(block1.el.getAttribute('role'), 'group')
assert.equal(block1.el.getAttribute('tabindex'), '0')
assert.equal(block1.el.getAttribute('aria-label'), 'Switch 1')
assert.ok(block1.el.classList.contains('ne-block'))
// ... and moves it by publishing custom properties, not inline transform declarations.
assert.equal(block1.el.style.getPropertyValue('--ne-x'), '30px')
editor.setPos('1', [50, 70])
assert.equal(block1.el.style.getPropertyValue('--ne-x'), '50px')
assert.equal(block1.el.style.getPropertyValue('--ne-y'), '70px')

// Adding a line that already exists is an error by design; the tolerant loader is `loadLines`.
assert.throws(() => editor.addConnectorFromTo('1/o1', '2/i1'), /already connected/)

// saveGraph is data, loadGraph rebuilds through the typeMap — the round trip a host persists.
const saved = editor.saveGraph()
assert.deepEqual(Object.keys(saved.blocks[0]).sort(), ['id', 'pos', 'type'])
editor.loadGraph(saved, typeMap)
assert.equal(editor.inspectConnectors().length, 4)
assert.ok(editor.lineExists('1/o1', '2/i1'))
assert.deepEqual(editor.saveGraph().lines, saved.lines)

// A corrupt line is reported and skipped, never thrown: one bad entry does not cost the document.
const tolerant = editor.loadLines([
  ['1/o1', '2/i1'], // a duplicate: skipped
  ['1/does-not-exist', '2/i1'], // an unknown endpoint: skipped
])
assert.equal(tolerant.skipped, 2)

// Events are custom events on the editor element; the `onne-*` JSX attribute is the same listener.
let moves = 0
editor.addEventListener('ne-move-done', () => moves++)
editor.setPos('2', [200, 220])
editor.dispatchEvent(new CustomEvent('ne-move-done', { detail: { nid: '2' } }))
assert.equal(moves, 1)

// Teardown: `destroy()` releases the observers and every listener; removing the element is enough.
assert.equal(editor.querySelectorAll('[ncid]').length, 4)
editor.destroy()
editor.remove()

console.log('getting-started example: all assertions passed')
