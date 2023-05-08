import { addClass } from '@jsx6/jsx6'

export function Message(attr) {
  addClass(attr, 'ne-block')
  return (
    <div {...attr}>
      <div class="ne-title" ne-drag ne-item>
        <b ncid="i1" ne-connect="in" />
        Block 2
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
