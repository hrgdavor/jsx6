import { classIf, hSvg, insert, listenCustom, runFuncNoArg } from '@jsx6/jsx6'

import { addFinalizer } from './listenUntil.js'
import { makeLineConnector } from './makeLineConnector.js'
import { makeLine } from './svgUtil.js'

/**
 * @typedef {import('./NodeEditor.jsx').LinePoint} LinePoint
 * @typedef {import('./NodeEditor.jsx').ConnectorData} ConnectorData
 */

export class ConnectLine {
  constructor({ strength = 60 } = {}) {
    this.strength = strength
    this.el = hSvg('g', {}, (this.line1 = makeLine(strength)), (this.line2 = makeLine(strength)))

    /** @type {LinePoint} */
    this.p1 = { pos: [0, 0], listen: [], align: 'right', con: null }

    /** @type {LinePoint} */
    this.p2 = { pos: [0, 0], listen: [], align: 'left', con: null }
    addFinalizer(this, () => this.finalize())
  }

  /**
   *
   * @param {ConnectorData|null} con
   * @param {boolean} [skipUpdate]
   */
  setPoint1(con, skipUpdate) {
    this.setPoint(this.p1, con, skipUpdate)
  }

  /**
   *
   * @param {ConnectorData} con
   * @param {boolean} [skipUpdate]
   */
  setPoint2(con, skipUpdate) {
    this.setPoint(this.p2, con, skipUpdate)
  }

  finalize() {
    this.p1.listen?.forEach(runFuncNoArg)
    this.p2.listen?.forEach(runFuncNoArg)
  }

  /**
   * @param {LinePoint} p
   * @param {ConnectorData} con
   * @param {boolean} [skipUpdate]
   */
  setPoint(p, con, skipUpdate) {
    let old = p.con
    if (old) p.listen?.forEach(runFuncNoArg)

    p.con = con
    if (!con) return

    this.setPosAligned(p, con, skipUpdate)
    p.listen[0] = listenCustom(con.el, 'ne-move', _detail => {
      this.setPosAligned(p, con)
    })
    p.listen[1] = listenCustom(con.el, 'ne-remove', _detail => {
      this.setPoint1(null)
    })
    if (!skipUpdate) this.updatePath()
  }

  /**
   *
   * @param {LinePoint} p
   * @param {ConnectorData} con
   * @param {boolean} [skipUpdate]
   */
  setPosAligned(p, con, skipUpdate) {
    let [x, y] = con.pos
    let [w, h] = con.size
    y += Math.floor(h / 2) + con.offsetY
    x += Math.floor(w / 2) + con.offsetX
    p.pos = [x, y]
    if (!skipUpdate) this.updatePath()
  }

  setPos(x1, y1, x2, y2) {
    this.p1.pos = [x1, y1]
    this.p2.pos = [x2, y2]
    this.updatePath()
  }

  /**
   *
   * @param {number} x
   * @param {number} y
   * @param {boolean} [skipUpdate]
   */
  setPos1(x, y, skipUpdate) {
    this.p1.pos = [x, y]
    if (!skipUpdate) this.updatePath()
  }

  /**
   *
   * @param {number} x
   * @param {number} y
   * @param {boolean} [skipUpdate]
   */
  setPos2(x, y, skipUpdate) {
    this.p2.pos = [x, y]
    if (!skipUpdate) this.updatePath()
  }

  updatePath() {
    let line = makeLineConnector(
      this.strength,
      this.p1.pos,
      this.p1.pos, // todo box pos
      [100, 100],
      'R',
      this.p2.pos,
      [0, 0], // todo box pos
      [100, 100],
      'L',
    )
    this.line1.setAttribute('d', line)
    this.line2.setAttribute('d', line)
  }

  /**
   * @param {boolean} sel
   */
  setSelected(sel) {
    this.selected = sel
    classIf(this.el, 'selected', sel)
  }
}
