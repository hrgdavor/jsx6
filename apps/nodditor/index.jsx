import { insert } from '@jsx6/jsx6'

import './main.css'
import './ne-blocks.css'
import { NodeEditor } from './src/NodeEditor.jsx'

const editor = (self.APP = (
  <NodeEditor class="fxs1 fx1">
    <div class="ne-block" nid="1">
      <div class="ne-title" ne-drag>
        Block 1
      </div>
      <div ne-nodrag>NO DRAG</div>
      <b lid="1">o</b>
      -------------
      <b rid="1">o</b>
    </div>
    <div class="ne-block" nid="2">
      <div class="ne-title" ne-drag>
        Block 1
      </div>
      <div ne-nodrag>NO DRAG</div>
      <b rid="1">o</b>
    </div>
  </NodeEditor>
))
insert(document.body, editor)
