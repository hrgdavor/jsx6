import { addClass } from '@jsx6/jsx6'

export function Message(attr) {
  addClass(attr, 'ne-block')
  return (
    <div {...attr}>
      <div class="ne-title" ne-drag ne-item>
        <b rid="1" ne-connect="in" />
        Block 2
      </div>
      <div ne-nodrag>NO DRAG</div>
      <div ne-item>
        bla bla
        <b rid="1" ne-connect="out" />
      </div>
    </div>
  )
}
