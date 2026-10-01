/**
 * The JSX demo page.
 *
 * It is a plain consumer: no jsx6 import of its own, and the only backend primitive it touches is
 * `insert` (which knows how to mount a component — the editor element — into the document). Every
 * other call is the editor's public API and plain DOM, which is why the demo surface needs no
 * `@jsx6/*` import (asserted by test/runtime.test.js).
 */
import { backend } from './runtime.js'

import { NodeEditor } from './NodeEditor.jsx'
import { Message } from './blocks/Message.js'
import { Switch } from './blocks/Switch.js'

import { createSvgLineLayer } from './lineLayer.js'
import { installCanvasLineLayer } from './canvasLineLayer.js'

// click through empty parts of SVG
// https://stackoverflow.com/questions/22483643/svg-still-receives-clicks-even-if-pointer-events-visible-painted/29319009#29319009

/**
 * This page deliberately does NOT persist the graph: it demonstrates the editor from INIT DATA, so
 * every reload starts from the same known graph.
 *
 * It used to save to `localStorage` on `ne-move-done`/`ne-remove` and restore on boot, which had two
 * problems worth remembering before adding persistence back:
 *
 *  - **The demo never saved on CONNECT.** Those two events are the only graph-level notifications the
 *    editor fires; a line added interactively (`LineInteraction` → `editor.addConnector(new
 *    ConnectLine())`) or through `addConnectorFromTo` fires none, so it reached `ne.graph` only after
 *    some later move or delete. Reloading right after connecting lost it.
 *  - **A stored graph outlived its format.** The boot preferred `ne.graph` over the seed and never
 *    re-seeded, so a graph saved without lines (e.g. through the gap above) made the page look
 *    connection-less on every reload, with nothing on screen to explain why.
 *
 * Both are the demo's problem, not the editor's: `saveGraph()` returns the live graph faithfully, and
 * `loadGraph()` reports `{attached, skipped}`. A host that persists should save on its OWN connect
 * path rather than waiting for an event, and must not write back a load that skipped lines.
 */

/**
 * Block component factories for `editor.loadGraph` and undo/redo (which
 * reuses it). They are FACTORIES (returning a fresh DOM node per call),
 * because `loadGraph` calls each one once per block.
 * @type {Object<string, Function>}
 */
let typeMap = {
  Switch: () => <Switch />,
  Message: () => <Message />,
}

function deleteSelection() {
  editor.deleteSelection()
}

/**
 * "E" edit button: start in-place editing of the first selected block's
 * EditableTitle (the same flow a real pointerup on the title triggers).
 */
function editTitle() {
  let blockData = editor.selectedBlocks?.[0]
  let title = blockData?.el.querySelector('.EditableTitle')
  if (title) title.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }))
}

function toggleSnap() {
  editor.snap = editor.snap ? 0 : 20
}

let menu = (
  <div class="fx ne-menu ne-demo-menu">
    <div class="ne-bt ne-delete" title="Delete selection" onclick={deleteSelection}>
      X
    </div>
    <div class="ne-bt" title="Edit title" onclick={editTitle}>
      E
    </div>
    <div class="ne-bt" title="Undo (Ctrl+Z)" onclick={() => editor.undo()}>
      ↶
    </div>
    <div class="ne-bt" title="Redo (Ctrl+Shift+Z)" onclick={() => editor.redo()}>
      ↷
    </div>
    <div class="ne-bt" title="Toggle grid snapping (20px)" onclick={toggleSnap}>
      ▦
    </div>
  </div>
)

/**  @type {NodeEditor} */
const editor = (
  <NodeEditor
    // @ts-ignore
    class="fxs1 fx1 NodeEditor ne-demo-editor"
    menu={() => menu}
    typeMap={typeMap}
    zoomMax={4}
    onwheel={e => {
      e.preventDefault()
      editor.changeZoomMouse(e.deltaY > 0 ? -0.1 : 0.1, e)
    }}
  />
)

backend.current.insert(document.body, <div class="fxs1 fx1">{editor}</div>)

/* ---- Line layer toggle: SVG (default) ↔ line-render (WebGPU canvas) ----

   The editor's line layer is pluggable (`editor.setLineLayer`); the default is the
   zero-dependency SVG layer. This toggle swaps in the WebGPU canvas layer from the
   OPTIONAL dependency `@jsx6/line-render` and back. If the package is not installed,
   or WebGPU is unavailable, the toggle reports it and the editor keeps the SVG layer. */
let lineLayerMode = 'svg'
let switchingLayer = false
const toggleLabel = document.createElement('span')
const toggleButton = document.createElement('button')
toggleButton.type = 'button'
const toggleBar = document.createElement('div')
toggleBar.className = 'ne-demo-line-toggle'
toggleBar.append(toggleLabel, toggleButton)

function updateToggleUi() {
  if (lineLayerMode == 'svg') {
    toggleLabel.textContent = 'line layer: SVG'
    toggleButton.textContent = 'switch to line-render (WebGPU)'
  } else if (lineLayerMode == 'canvas') {
    toggleLabel.textContent = 'line layer: line-render (WebGPU)'
    toggleButton.textContent = 'switch back to SVG'
  } else {
    toggleLabel.textContent = 'line layer: SVG — line-render unavailable'
    toggleButton.disabled = true
    toggleButton.textContent = 'unavailable'
  }
}

async function switchToCanvas() {
  if (switchingLayer || lineLayerMode != 'svg') return
  switchingLayer = true
  try {
    // one call does probe → build → await ready → fall back to the SVG layer, and
    // reports which layer we ended up on ('canvas' or 'svg')
    const { mode } = await installCanvasLineLayer(editor, {
      // the helper swaps in a fresh SVG layer before calling this, so the toggle
      // only has to reflect it
      onLost: () => {
        lineLayerMode = 'unavailable'
        updateToggleUi()
      },
    })
    lineLayerMode = mode === 'canvas' ? 'canvas' : 'unavailable'
    updateToggleUi()
  } finally {
    switchingLayer = false
  }
}

toggleButton.onclick = () => {
  if (lineLayerMode == 'canvas') {
    editor.setLineLayer(createSvgLineLayer(editor))
    lineLayerMode = 'svg'
    updateToggleUi()
  } else {
    switchToCanvas()
  }
}
updateToggleUi()
backend.current.insert(document.body, toggleBar)

// The demo's initial data — the graph every reload starts from (see the note at the top of this
// file for why this page does not persist anything). Ids 1,2 render as Switch blocks and 3,4 as
// Message blocks, so the two seeded lines exercise both a normal and a `Switch` output.
const defaultGraph = {
  blocks: [
    { id: '1', type: 'Switch', pos: [30, 10] },
    { id: '2', type: 'Switch', pos: [30, 220] },
    { id: '3', type: 'Message', pos: [200, 100] },
    { id: '4', type: 'Message', pos: [510, 60] },
  ],
  lines: [
    ['1/o1', '2/i1'],
    ['1/o3', '2/i1'],
  ],
}

// one-time tidy-up: this page used to persist here, and a browser that still holds those keys would
// otherwise keep a graph the demo no longer reads (and `ne.positions` predates even that)
try {
  localStorage.removeItem('ne.graph')
  localStorage.removeItem('ne.positions')
} catch {
  // private mode / storage disabled: nothing to clean up, and nothing depends on it
}

setTimeout(() => {
  // INIT DATA, always: no stored graph is consulted, so the page cannot come up empty or stale.
  // `loadGraph` reports what it wired, which is asserted in the test suite; here it is only worth a
  // console line if the seed itself stops attaching (i.e. someone edited `defaultGraph` badly).
  let { attached, skipped } = editor.loadGraph(defaultGraph)
  if (skipped) console.warn(`nodditor demo: defaultGraph attached ${attached} line(s), skipped ${skipped}`)
}, 1)

//editor.getConnectorPos(1, 'o1')
