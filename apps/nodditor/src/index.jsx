import { h, hSvg, insert } from '@jsx6/jsx6'

import { NodeEditor } from './NodeEditor.jsx'
import { Message } from './blocks/Message.js'
import { Switch } from './blocks/Switch.js'
import './main.css'
import { makeLineConnector } from './makeLineConnector.js'
import './ne-blocks.css'

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
    <Switch nid="1" style="top:10px; left:30px;" />
    <Switch nid="2" style="top:220px; left:30px;" />
    <Message nid="3" style="top:100px; left:200px;" />
    {svgLayer}
  </NodeEditor>
))
insert(document.body, editor)
