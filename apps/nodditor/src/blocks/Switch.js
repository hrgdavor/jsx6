import { addClass } from '@jsx6/jsx6'

import { EditableTitle } from '../EditableTitle.js'

export function Switch(attr) {
  function expandClick({ target }) {
    if (target.hasAttribute('ne-item')) return
    target.innerHTML += '<br/>-----------'
  }
  addClass(attr, 'ne-block')
  // P2: the title uses the shared in-place editor, like `Message` does, so
  // the context-menu "E" button works for every block type
  let title = EditableTitle({ onchange: e => console.log('change') })
  title.setValue('Block 1')
  return (
    <div {...attr}>
      <div class="ne-title" ne-drag ne-item>
        <b ncid="i1" ne-connect="in" />
        {title}
      </div>
      <div class="ne-content">
        <div ne-nodrag>NO DRAG</div>
        <div ne-item>
          <div onclick={expandClick}>-------------</div>
          <b ncid="o1" ne-connect="out" />
        </div>
        <div ne-item>
          <div onclick={expandClick}>-------------</div>
          <b ncid="o2" ne-connect="out" />
        </div>
        <div ne-item>
          <div onclick={expandClick}>-------------</div>
          <b ncid="o3" ne-connect="out" />
        </div>
      </div>
    </div>
  )
}
