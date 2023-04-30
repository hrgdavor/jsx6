import { h, hSvg, insert } from '@jsx6/jsx6'

import './main.css'
import './ne-blocks.css'
import { NodeEditor } from './src/NodeEditor.jsx'
import { makeLineConnector } from './src/makeLineConnector.js'

const points = {}
const strength = 60
const path = hSvg('path', {
  strength,
  style: 'vector-effect:non-scaling-stroke;stroke-width:2;pointer-events:auto;',
  fill: 'none',
  stroke: 'black',
})

// click through empty parts of SVG
// https://stackoverflow.com/questions/22483643/svg-still-receives-clicks-even-if-pointer-events-visible-painted/29319009#29319009

const onMove = ({ detail }) => {
  points[detail.nid] = detail
  if (points[1] && points[2]) {
    let { 1: p1, 2: p2 } = points
    path.setAttribute('d', makeLineConnector(strength, p1.left + p1.el.offsetWidth, p1.top + 10, p2.left, p2.top + 10))
  }
}
const svgLayer = hSvg('svg', { style: 'position:absolute;pointer-events: none; width: 100%; height: 100%;' }, path)

console.log('line', svgLayer)

const editor = (self.APP = (
  <NodeEditor class="fxs1 fx1" onne-move={onMove}>
    <div class="ne-block" nid="1" style="top:10px; left:30px;">
      <div class="ne-title" ne-drag>
        Block 1
      </div>
      <div ne-nodrag>NO DRAG</div>
      <b lid="1">o</b>
      -------------
      <b rid="1">o</b>
    </div>
    <div class="ne-block" nid="2" style="top:100px; left:200px;">
      <div class="ne-title" ne-drag>
        Block 2
      </div>
      <div ne-nodrag>NO DRAG</div>
      <b rid="1">o</b>
    </div>
    {svgLayer}
  </NodeEditor>
))
insert(document.body, editor)
