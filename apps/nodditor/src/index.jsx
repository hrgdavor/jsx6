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
import { loadLineRender, makeCanvasLineLayer } from './canvasLineLayer.js'

// click through empty parts of SVG
// https://stackoverflow.com/questions/22483643/svg-still-receives-clicks-even-if-pointer-events-visible-painted/29319009#29319009

/**
 * Persist the whole graph (blocks + connections + positions) to
 * localStorage. Fired on every `ne-move-done` and on `ne-remove`, so the
 * demo graph survives both moves and deletions across reloads.
 */
const saveGraph = () => {
  localStorage.setItem('ne.graph', JSON.stringify(editor.saveGraph()))
}

const moveDone = () => {
  saveGraph()
}

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
    onne-move-done={moveDone}
    onne-remove={saveGraph}
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
    const lr = await loadLineRender()
    // `isSupported()` is the synchronous capability probe: no point building a
    // layer (or waiting on `ready`) when the browser has no WebGPU at all
    if (!lr || !lr.LineRenderer.isSupported()) {
      lineLayerMode = 'unavailable'
      updateToggleUi()
      return
    }
    const layer = makeCanvasLineLayer(editor, lr, {
      // A device lost after startup (driver reset, GPU process crash) is the
      // same story as a failed init: fall back to the SVG layer for good.
      onLost: () => {
        editor.setLineLayer(createSvgLineLayer(editor))
        lineLayerMode = 'unavailable'
        updateToggleUi()
      },
    })
    editor.setLineLayer(layer)
    // drawing starts when the GPU is ready; if init fails (no WebGPU), go back to SVG
    layer.ready
      .then(() => {
        lineLayerMode = 'canvas'
        updateToggleUi()
      })
      .catch(() => {
        editor.setLineLayer(createSvgLineLayer(editor))
        lineLayerMode = 'unavailable'
        updateToggleUi()
      })
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

// the default demo graph, used on first run and as the migration target for
// the old position-only `ne.positions` storage
let defaultGraph = {
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

setTimeout(() => {
  let graph = localStorage.getItem('ne.graph')
  if (graph) {
    editor.loadGraph(JSON.parse(graph))
  } else {
    let positions = localStorage.getItem('ne.positions')
    if (positions) {
      // migrate the old position-only storage into the full graph format:
      // ids 1,2 are Switch blocks and 3,4 are Message blocks
      positions = JSON.parse(positions)
      defaultGraph = {
        blocks: [
          { id: '1', type: 'Switch', pos: positions['1'] },
          { id: '2', type: 'Switch', pos: positions['2'] },
          { id: '3', type: 'Message', pos: positions['3'] },
          { id: '4', type: 'Message', pos: positions['4'] },
        ],
        lines: [
          ['1/o1', '2/i1'],
          ['1/o3', '2/i1'],
        ],
      }
    }
    editor.loadGraph(defaultGraph)
  }
  saveGraph()
}, 1)

//editor.getConnectorPos(1, 'o1')
