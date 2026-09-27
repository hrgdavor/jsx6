import { backend } from './runtime.js'

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
      if (con) backend.current.classIf(con.el, 'target', mark)
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

    /** latest pointer position, consumed by `hoverStep` (P3-5) */
    let lastX = 0
    let lastY = 0
    let hoverRaf = 0
    /**
     * P3-5: resolve the hover target. `document.elementFromPoint` hit-tests the
     * whole page (and forces layout), and pointer events arrive faster than the
     * display refreshes, so this runs at most once per animation frame with the
     * latest coordinates.
     */
    const hoverStep = () => {
      if (!isDown || !isMoving) return
      /** @type {DOMRect} */
      //@ts-ignore
      let rect = this.editor.getBoundingClientRect()
      let x = lastX
      let y = lastY
      let target2 = /** @type {HTMLConnector} */ (document.elementFromPoint(x, y))
      let connectorData = target2?.ncData
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
        setFreePos((x - 1 - rect.x) / this.editor.zoom, (y - rect.y) / this.editor.zoom)
      }
    }
    const scheduleHover = () => {
      if (hoverRaf) return
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = 0
        hoverStep()
      })
    }
    /** apply the pending pointer position NOW (used before `pointerup` decides) */
    const flushHover = () => {
      if (!hoverRaf) return
      cancelAnimationFrame(hoverRaf)
      hoverRaf = 0
      hoverStep()
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
      let x = (lastX = e.clientX)
      let y = (lastY = e.clientY)

      if (!isMoving) {
        // reuse the line grabbed from a selected endpoint, or create a new one
        if (!line) line = this.editor.addConnector(new ConnectLine())
        this.editor.selectConnector(line)
        line.setSelected(true)
        if (!line.p1.con) line.setPoint1(con)
        firstCon = con
        markTarget(con, 1)
        /** @type {DOMRect} */
        //@ts-ignore
        let rect = this.editor.getBoundingClientRect()
        setFreePos((x - 1 - rect.x) / this.editor.zoom, (y - rect.y) / this.editor.zoom)

        // pointer capture inside pointerdown caused clicking to not work
        // it is better to capture pointer only on pointer down + first movement
        con.el.setPointerCapture(e.pointerId)
        isMoving = true
      }
      // P3-5: the hover hit test walks the page and forces layout, so the
      // pointer events of one frame are coalesced into a single
      // `document.elementFromPoint` call (with the latest position)
      scheduleHover()
    }

    const pointerup = e => {
      if (!isDown) return
      // the last pointer events of the drag may still be coalesced: resolve
      // their target before deciding whether a line was connected
      flushHover()
      if (isMoving) con.el.releasePointerCapture(e.pointerId)
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
      // connect/re-point finished: record it for undo (a failed drag removed
      // the temporary line again, so `historyRecord` sees no change)
      this.editor.historyRecord('connect')
      this.editor.focus()
    }

    listenUntil(con.el, con.el, 'pointerdown', pointerdown)
    listenUntil(con.el, con.el, 'pointermove', pointermove)
    listenUntil(con.el, con.el, 'pointerup', pointerup)
  }
}
