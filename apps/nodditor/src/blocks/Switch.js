import { addClass } from '@jsx6/jsx6'

export function Switch(attr) {
  function expandClick({ target }) {
    let el
  }
  addClass(attr, 'ne-block')
  return (
    <div {...attr}>
      <div class="ne-title" ne-drag ne-item>
        <b lid="1" ne-connect="in" />
        Block 1
      </div>
      <div ne-nodrag>NO DRAG</div>
      <div ne-item onclick={expandClick}>
        -------------
        <b rid="1" ne-connect="out" />
      </div>
      <div ne-item onclick={expandClick}>
        -------------
        <b rid="1" ne-connect="out" />
      </div>
      <div ne-item onclick={expandClick}>
        -------------
        <b rid="1" ne-connect="out" />
      </div>
    </div>
  )
}
