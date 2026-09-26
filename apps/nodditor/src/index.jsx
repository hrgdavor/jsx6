import { forEachProp, insert, provideErrTranslations } from '@jsx6/jsx6'
import { $State } from '@jsx6/signal'

import { ConnectLine } from './ConnectLine.js'
import { EditableTitle } from './EditableTitle.js'
import { NodeEditor } from './NodeEditor.jsx'
import { Message } from './blocks/Message.js'
import { Switch } from './blocks/Switch.js'

provideErrTranslations()

const points = {}

// click through empty parts of SVG
// https://stackoverflow.com/questions/22483643/svg-still-receives-clicks-even-if-pointer-events-visible-painted/29319009#29319009

const onMove = ({ detail }) => {
  points[detail.nid] = detail
  // if (points[1] && points[2]) {
  //   let { 1: p1, 2: p2 } = points
  //   // path.setPos(p1[0], p1[1],p2[0],p2[1])
  //   path.setPos(p1.left + p1.domNode.offsetWidth, p1.top + 10, p2.left, p2.top + 10)
  // }
}

/**
 * Persist the whole graph (blocks + connections + positions) to
 * localStorage. Fired on every `ne-move-done` and on `ne-remove`, so the
 * demo graph survives both moves and deletions across reloads.
 */
const saveGraph = () => {
  localStorage.setItem('ne.graph', JSON.stringify(editor.saveGraph()))
}

const moveDone = ({ detail }) => {
  saveGraph()
}

function deleteBlocks() {
  editor.deleteSelectedBlocks()
}

/** @type {any} */
let $s = $State({ hasEdit: true })
let menu = (
  <div class="fx ne-menu" style="padding: 4px; border: solid 1px gray">
    <div class="ne-bt ne-delete" onclick={deleteBlocks}>
      X
    </div>
  </div>
)

menu.afterAdd = function (blocks) {
  let blockData = blocks[0]
}

/**  @type {NodeEditor} */
const editor = (
  <NodeEditor
    // @ts-ignore
    class="fxs1 fx1"
    menu={() => menu}
    onwheel={e => {
      e.preventDefault()
      editor.changeZoomMouse(e.deltaY > 0 ? -0.1 : 0.1, e)
      // editor.changeZoomCenter(e.deltaY > 0 ? -0.1 : 0.1)
    }}
    onne-move={onMove}
    onne-move-done={moveDone}
    onne-remove={saveGraph}
    style="width: 800px; height: 500px; outline: solid 1px black; contain:strict"
  />
)

insert(document.body, <div>{editor}</div>)

/**
 * Block component factories for `editor.loadGraph`. They are FACTORIES
 * (returning a fresh DOM node per call), because `loadGraph` calls each one
 * once per block.
 * @type {Object<string, Function>}
 */
let typeMap = {
  Switch: () => <Switch />,
  Message: () => <Message />,
}

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
    editor.loadGraph(JSON.parse(graph), typeMap)
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
    editor.loadGraph(defaultGraph, typeMap)
  }
  saveGraph()
}, 1)

//editor.getConnectorPos(1, 'o1')
