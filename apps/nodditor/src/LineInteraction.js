import { classIf } from '@jsx6/jsx6'

import { ConnectLine } from './ConnectLine.js'
import { NodeEditor } from './NodeEditor.jsx'
import { listenCustomUntil, listenUntil } from './listenUntil.js'

/**
 * @typedef {import('./NodeEditor.jsx').ConnectorData} ConnectorData
 * @typedef {import('./NodeEditor.jsx').HTMLConnector} HTMLConnector
 */

export class LineInteraction {
  /** @type {NodeEditor} */
  editor

  /**
   * @param {NodeEditor} editor
   */
  constructor(editor) {
    this.editor = editor
  }

  /**
   * @param {ConnectorData} con
   */
  newConnector(con) {
    const markTarget = (con, mark) => {
      if (con) classIf(con.el, 'target', mark)
    }
    let isDown = false
    let isMoving = false
    let lx = 0
    let ly = 0
    /** @type {ConnectLine} */
    let line
    /** @type {ConnectorData} */
    let firstCon
    /** @type {ConnectorData} */
    let otherCon
    /** @type {'p1' | 'p2'} */
    let freeEnd

    const setFreePos = (x, y) => {
      if (freeEnd == 'p1') line.setPos1(x, y)
      else line.setPos2(x, y)
    }
    const setFreePoint = c => {
      if (freeEnd == 'p1') line.setPoint1(c)
      else line.setPoint2(c)
    }

    const pointerdown = e => {
      // adding only from output for now
      lx = e.clientX
      ly = e.clientY

      let selected = this.editor.selectedLine
      if (selected) {
        if (selected.p2.con == con) {
          line = selected
          firstCon = con
          freeEnd = 'p2'
          isDown = true
          return
        }
        if (selected.p1.con == con) {
          line = selected
          firstCon = con
          freeEnd = 'p1'
          isDown = true
          return
        }
      }

      if (con.dir == 'in') return
      if (this.editor.lineHasConnector(con)) return
      freeEnd = 'p2'
      isDown = true
    }

    const pointermove = e => {
      if (!isDown) return
      /** @type {DOMRect} */
      //@ts-ignore
      let rect = this.editor.getBoundingClientRect()
      let lx = rect.x
      let ly = rect.y
      let x = e.clientX
      let y = e.clientY

      if (isDown && !isMoving) {
        // reuse the line grabbed from a selected endpoint, or create a new one
        if (!line) line = this.editor.addConnector(new ConnectLine())
        this.editor.selectConnector(line)
        line.setSelected(true)
        if (!line.p1.con) line.setPoint1(con)
        firstCon = con
        markTarget(con, 1)

        setFreePos((x - 1 - lx) / this.editor.zoom, (y - ly) / this.editor.zoom)

        // pointer capture inside pointerdown caused clicking to not work
        // it is better to capture pointer only on pointer down + first movement
        con.el.setPointerCapture(e.pointerId)
        isMoving = true
      }
      let target2 = /** @type {HTMLConnector} */ (document.elementFromPoint(x, y))
      let connectorData = target2.ncData
      // do not allow connect to output as second part
      if (connectorData?.dir == 'out') connectorData = null

      if (connectorData && connectorData != firstCon) {
        markTarget(connectorData, 1)
        otherCon = connectorData
        setFreePoint(otherCon)
      } else {
        if (otherCon) markTarget(otherCon, connectorData == otherCon)
        if (connectorData == firstCon || !connectorData) {
          otherCon = null
        }
        setFreePos((x - 1 - lx) / this.editor.zoom, (y - ly) / this.editor.zoom)
      }
    }

    const pointerup = e => {
      if (!isDown) return
      if (isDown && isMoving) con.el.releasePointerCapture(e.pointerId)
      markTarget(firstCon)
      markTarget(otherCon)
      if (otherCon) {
        line.setSelected(true)
      } else {
        this.editor.removeLine(line)
      }
      isDown = false
      isMoving = false
      line = null
      this.editor.focus()
    }

    listenUntil(con.el, con.el, 'pointerdown', pointerdown)
    listenUntil(con.el, con.el, 'pointermove', pointermove)
    listenUntil(con.el, con.el, 'pointerup', pointerup)
  }
}
