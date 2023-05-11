import { forEachProp, insert } from '@jsx6/jsx6'

import { ConnectLine } from './ConnectLine.js'
import { NodeEditor } from './NodeEditor.jsx'
import { Message } from './blocks/Message.js'
import { Switch } from './blocks/Switch.js'
import { makeLineConnector } from './makeLineConnector.js'

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

/**  @type {NodeEditor} */
// @ts-ignore
const editor = <NodeEditor class="fxs1 fx1" onne-move={onMove} onne-move-done={moveDone} style="margin-left: 50px" />

insert(document.body, editor)
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
}, 1)

//editor.getConnectorPos(1, 'o1')
