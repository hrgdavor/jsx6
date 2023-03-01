import { observeResize } from '@jsx6/dom-observer'
import { Jsx6, addToBody, classIf, findParent, getAttr, insert } from '@jsx6/jsx6'

export class NodeEditor extends Jsx6 {
  tpl() {
    const { $s, el } = this

    let isDown = false
    let isMoving = false
    let lx = 0
    let ly = 0
    let box

    el.addEventListener('pointerdown', e => {
      let hasBlock
      let hasDrag
      box = findParent(e.target, p => {
        if (!p.hasAttribute) return false
        if (p.hasAttribute('ne-drag')) hasDrag = true
        if (p.hasAttribute('ne-nodrag')) hasBlock = true
        return p.hasAttribute('nid')
      })
      if (!box || !hasDrag || hasBlock) return

      lx = e.clientX
      ly = e.clientY
      box.startTop = box.offsetTop
      box.startLeft = box.offsetLeft
      console.log('box', box, lx, ly, box.startLeft, box.startTop)
      isDown = true
    })

    el.addEventListener('pointerup', e => {
      isDown = false
      if (isMoving) el.releasePointerCapture(e.pointerId)
      isMoving = false
    })

    el.addEventListener('pointermove', e => {
      if (!isDown) return

      if (!isMoving) {
        // pointer capture inside pointerdown caused clicking to not work
        // it is better to capture pointer only on pointer down + first movement
        el.setPointerCapture(e.pointerId)
        isMoving = true
      }

      const { style } = box
      let dx = lx - e.clientX
      let dy = ly - e.clientY
      style.left = box.startLeft - dx + 'px'
      style.top = box.startTop - dy + 'px'
    })

    return <></>
  }
}
