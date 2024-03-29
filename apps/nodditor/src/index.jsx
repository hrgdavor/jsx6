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

const moveDone = ({ detail }) => {
  let positions = {}
  editor.blocks.forEach(block => {
    positions[block.id] = block.pos
  })
  localStorage.setItem('ne.positions', JSON.stringify(positions))
}

function deleteBlocks() {
  editor.deleteSelectedBlocks()
}

/** @type {any} */
let $s = $State({ hasEdit: true })
let menu = (
  <div class="fx ne-menu" sty:le="padding: 4px; border: solid 1px gray">
    <div class="ne-bt ne-delete" onclick={deleteBlocks}>
      X
    </div>
    <div class="ne-bt" x-if={$s.hasEdit}>
      E
    </div>
  </div>
)

menu.afterAdd = function (blocks) {
  let blockData = blocks[0]
}

/**  @type {NodeEditor} */
const editor = (window.editor = (
  <NodeEditor
    // @ts-ignore
    class="fxs1 fx1"
    menu={() => menu}
    onwheel={e => {
      editor.changeZoomMouse(e.deltaY > 0 ? -0.1 : 0.1, e)
      // editor.changeZoomCenter(e.deltaY > 0 ? -0.1 : 0.1)
    }}
    onne-move={onMove}
    onne-move-done={moveDone}
    style="width: 800px; height: 500px; outline: solid 1px black; contain:strict"
  />
))

insert(document.body, <div>{editor}</div>)

setTimeout(() => {
  let positions = localStorage.getItem('ne.positions')
  if (positions) positions = JSON.parse(positions)
  else {
    // @ts-ignore
    positions = {
      1: [30, 10],
      2: [30, 220],
      3: [200, 100],
      4: [510, 60],
    }
  }

  // @ts-ignore
  editor.add(<Switch />, '1', { pos: positions['1'] })
  // @ts-ignore
  editor.add(<Switch />, '2', { pos: positions['2'] })
  // @ts-ignore
  editor.add(<Message />, '3', { pos: positions['3'] })

  // @ts-ignore
  editor.add(<Message />, '4', { pos: positions['4'] })

  forEachProp(positions, (pos, key) => editor.setPos(key, pos))

  editor.addConnectorFromTo('1/o1', '2/i1')
  editor.addConnectorFromTo('1/o3', '2/i1')
}, 1)

//editor.getConnectorPos(1, 'o1')
