import { backend } from '../runtime.js'

import { EditableTitle } from '../EditableTitle.js'

export function Message(attr) {
  // merges with a host-supplied class instead of overwriting it — see the note in blocks/Switch.js
  backend.current.addClass(attr, 'ne-block')
  let title = EditableTitle()
  title.setValue('Message')
  return (
    <div {...attr}>
      <div class="ne-title" ne-drag ne-item>
        <b ncid="i1" ne-connect="in" />
        {title}
      </div>
      <div class="ne-content">
        <div ne-nodrag>NO DRAG</div>
        <div ne-item>
          bla bla
          <b ncid="o1" ne-connect="out" />
        </div>
      </div>
    </div>
  )
}
