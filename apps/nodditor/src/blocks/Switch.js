import { addClass } from '@jsx6/jsx6'

export function Switch(attr) {
  function expandClick({ target }) {
    if (target.hasAttribute('ne-item')) return
    target.innerHTML += '<br/>-----------'
  }
  addClass(attr, 'ne-block')
  return (
    <div {...attr}>
      <div class="ne-title" ne-drag ne-item>
        <b ncid="i1" ne-connect="in" />
        Block 1
      </div>
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
  )
}
