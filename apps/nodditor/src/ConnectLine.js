import { backend } from './runtime.js'

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
    this.el = backend.current.hSvg('g', {}, (this.line1 = makeLine(strength)), (this.line2 = makeLine(strength)))
    // Lines carry NO accessibility markup and are NOT focusable: `role="img"` + `tabindex="0"` made
    // the browser draw a focus outline around the whole `g` (the gray box around a selected line),
    // and the endpoint `aria-label` duplicated what the stroke colour already shows. Selection is
    // communicated by the `.selected` class and the `ne-from-sel-block` / `ne-to-sel-block` classes.
    this.updateAria()

    /** @type {LinePoint} */
    this.p1 = { pos: [0, 0], listen: [], align: 'right', con: null }

    /** @type {LinePoint} */
    this.p2 = { pos: [0, 0], listen: [], align: 'left', con: null }

    /**
     * @type {Array<(d: string) => void>} path-change callbacks: the canvas line
     * layer subscribes so a line whose FREE end is being dragged (connect-in-
     * progress, `p*.con` still null) keeps being drawn. Subscribers are expected
     * to be rAF-batched; the callback itself is a cheap schedule call.
     */
    this.pathListeners = []
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
    this.p1.listen?.forEach(backend.current.runFuncNoArg)
    this.p2.listen?.forEach(backend.current.runFuncNoArg)
    this.pathListeners.length = 0
  }

  /**
   * @param {LinePoint} p
   * @param {ConnectorData} con
   * @param {boolean} [skipUpdate]
   */
  setPoint(p, con, skipUpdate) {
    let old = p.con
    p.con = con
    if (old) p.listen?.forEach(backend.current.runFuncNoArg)
    this.updateAria()
    if (!con) return

    this.setPosAligned(p, con, skipUpdate)
    // P3-2: moved connectors arrive as ONE batched `ne-move` on the editor
    // (`detail = {stamp, connectors}`) instead of one event per connector.
    // `flushMoves` stamps `movedStamp` on the live ConnectorData, so the
    // "did MY endpoint move in this batch?" test is O(1). Without an editor
    // (a standalone line) fall back to the legacy element-level event.
    let source = con.root?.editor || con.editor
    p.listen[0] = source
      ? backend.current.listenCustom(source, 'ne-move', detail => {
          if (detail.stamp === con.movedStamp) this.setPosAligned(p, con)
        })
      : backend.current.listenCustom(con.el, 'ne-move', () => {
          this.setPosAligned(p, con)
        })
    p.listen[1] = backend.current.listenCustom(con.el, 'ne-remove', _detail => {
      this.setPoint(p, null)
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
    // `d` is the single source of truth for the line shape: the SVG paths
    // read it via `setAttribute`, and the canvas line layer parses it
    // (`@jsx6/line-render`'s `parseLinePath`).
    this.d = line
    this.line1.setAttribute('d', line)
    this.line2.setAttribute('d', line)
    this.pathListeners.forEach(fn => fn(line))
  }

  /**
   * Register a callback invoked whenever the path is recomputed, with the new
   * `d`. Returns an unregister function.
   *
   * Used by the canvas line layer to redraw while a free (still unconnected)
   * end is being dragged: that move fires no `ne-move` event, and the SVG
   * paths that `updatePath` updates are not in the DOM in canvas mode.
   *
   * @param {(d: string) => void} fn
   * @returns {() => void}
   */
  onPathChange(fn) {
    this.pathListeners.push(fn)
    return () => {
      let i = this.pathListeners.indexOf(fn)
      if (i >= 0) this.pathListeners.splice(i, 1)
    }
  }

  /**
   * Kept as a no-op for backward compatibility (and because `setPoint` calls it).
   *
   * It used to write the endpoint pair into an `aria-label` on the line's `g`. Lines are no longer
   * focusable and carry no accessibility markup, so there is nothing to update. Endpoints are still
   * readable from the DOM through the line's `p1.con.idFull` / `p2.con.idFull`.
   */
  updateAria() {}

  /**
   * @param {boolean} sel
   */
  setSelected(sel) {
    this.selected = sel
    backend.current.classIf(this.el, 'selected', sel)
  }
}
