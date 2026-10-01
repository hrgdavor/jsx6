import { backend } from './runtime.js'

import { nextChangeId } from './changeSeq.js'
import { addFinalizer } from './listenUntil.js'
import { connectorEdge, edgeToSvg, pointsBounds, sampleEdgePoints } from './makeLineConnector.js'
import { makeLine } from './svgUtil.js'

/**
 * @typedef {import('./NodeEditor.jsx').LinePoint} LinePoint
 * @typedef {import('./NodeEditor.jsx').ConnectorData} ConnectorData
 * @typedef {import('./makeLineConnector.js').LineEdge} LineEdge
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
     * The line's shape as DATA — the single source of truth (see `updatePath`).
     * `null` until the first `updatePath()`.
     *
     * @type {LineEdge|null}
     */
    this.edge = null

    /**
     * Change id of the current shape, stamped from the process-wide sequence
     * (`./changeSeq.js`). Every cache below is dropped when it moves, and a consumer
     * that caches something per line (the canvas layer pins a render edge, an index
     * would pin a leaf) validates it by comparing against THIS — a line-local test
     * that ignores what else changed.
     *
     * @type {number}
     */
    this.changeId = 0

    /**
     * Cached SVG `M…C…` text for `edge`, built on demand by `pathText` and cleared
     * by every change. The SVG layer writes it into the two `<path>`s.
     *
     * @type {string|null}
     */
    this.svgText = null

    /**
     * Cached sampled polyline of `edge` (WORLD coordinates, `[x, y, …]` pairs),
     * built on demand by `samplePoints` and cleared by every change. Hit detection
     * walks it instead of re-sampling the curve, and pan/zoom never invalidate it.
     *
     * @type {Float64Array|null}
     */
    this.points = null

    /** @type {number[]|null} cached AABB of `points` (`[minX, minY, maxX, maxY]`) */
    this.pointsBox = null

    /** @type {number} segment count `points` was sampled with */
    this.pointsSegments = 0

    /**
     * @type {Array<(changeId: number) => void>} shape-change callbacks. The layers
     * subscribe: the SVG layer re-applies the (cached) text to its `<path>`s, the
     * canvas layer schedules a redraw. Subscribers are expected to be rAF-batched;
     * the callback itself is a cheap schedule call.
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

  /**
   * Recompute the line's shape from its two points. The shape is stored as numeric
   * DATA (`this.edge`); the SVG text and the sampled polyline are DERIVED from it,
   * built on demand (`pathText`, `samplePoints`) and cached until the next change —
   * so a move costs one Bezier formula plus a change id, and the layers pick up
   * "something changed" through `changed()`.
   *
   * Nothing here touches the DOM: the ACTIVE line layer renders (the SVG layer
   * writes `line.pathText` into the two `<path>`s, the canvas layer refreshes its
   * pinned edge), which is what keeps the line model free of renderer details.
   */
  updatePath() {
    this.edge = connectorEdge(this.strength, this.p1.pos, this.p2.pos)
    this.changed()
  }

  /**
   * A new shape is in place: drop every cached derivation of the old one, stamp a
   * new change id from the process-wide sequence and notify the layers.
   *
   * Caches are dropped EAGERLY (rather than version-checked lazily) because they are
   * rebuilt once per change, not once per frame, and a stale `points` array is a
   * correctness hazard (hit detection) — leaving nothing behind is the simpler
   * guarantee.
   */
  changed() {
    this.changeId = nextChangeId()
    this.svgText = null
    this.points = null
    this.pointsBox = null
    this.pointsSegments = 0
    const changeId = this.changeId
    this.pathListeners.forEach(fn => fn(changeId))
  }

  /**
   * The SVG `M…C…` text of the current shape, built once per change and cached in
   * `svgText`. `line.d` is kept as the historical alias of this.
   *
   * @returns {string|null}
   */
  get pathText() {
    if (this.svgText === null && this.edge) this.svgText = edgeToSvg(this.edge)
    return this.svgText
  }

  /**
   * @deprecated use `pathText` — kept because hosts and older code read `line.d`.
   * @returns {string|null}
   */
  get d() {
    return this.pathText
  }

  /**
   * The sampled polyline of the current shape, built once per change and cached on
   * the line (see `points`), together with its AABB (`pointsBox`).
   *
   * Hit detection walks this: the points are in WORLD coordinates and picking
   * converts the POINTER into that space, so a pan or a zoom never invalidates them
   * — only a shape change does.
   *
   * @param {number} [segments = 24] sampling of the cubic; the canvas layer passes
   *   the same value it hands to `pickEdge`
   * @returns {Float64Array|null}
   */
  samplePoints(segments = 24) {
    if (!this.edge) return null
    if (this.points === null || this.pointsSegments !== segments) {
      this.points = sampleEdgePoints(this.edge, segments)
      this.pointsBox = pointsBounds(this.points)
      this.pointsSegments = segments
    }
    return this.points
  }

  /**
   * Register a callback invoked whenever the shape is recomputed, with the new
   * change id. Returns an unregister function.
   *
   * Used by the line layers: the SVG layer re-applies the cached text to its
   * `<path>`s, and the canvas layer redraws (which it must do even while a free end
   * is being dragged — that move fires no `ne-move` event).
   *
   * @param {(changeId: number) => void} fn
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
