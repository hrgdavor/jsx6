import {
  classIf,
  findParent,
  fireCustom,
  getAttr,
  hSvg,
  insert,
  isNode,
  listen,
  remove,
  setAttribute,
  setSelected,
  setVisible,
  toDomNode,
} from '@jsx6/jsx6'
import { $Or, observeNow } from '@jsx6/signal'
import { JsxW, define } from '@jsx6/w'

import { ConnectLine } from './ConnectLine.js'
import { LineInteraction } from './LineInteraction.js'
import { findConnector, recalcPos, updatePos } from './connectorUtil.js'
import { getBlocksMinXY } from './getBlocksMinXY.js'
import { finalize, listenUntil } from './listenUntil.js'
import { moveMenu } from './moveMenu.js'
import { pairChanged } from './pairUtils.js'
import { updateObserver } from './updateObserver.js'

/**
  @typedef BlockData
  @property {string} id
  @property {string} type
  @property {Array<number>} pos
  @property {Array<number>} size
  @property {HTMLElement} el
  @property {Object} block
  @property {Map<string, ConnectorData>} map
  @property {Set<Element>} resizeSet
  @property {Map<string, ConnectorData>} connectorMap
  @property {NodeEditor} editor
  @property {boolean} structDirty block DOM changed structurally: connector
   discovery has to walk the subtree again (P3-1, see `findConnector`)

  @typedef  HTMLBlock_
  @property {BlockData} neBlock

  @typedef  {HTMLElement & HTMLBlock_} HTMLBlock
  
  @typedef ConnectorData
  @property {string} id
  @property {string} dir
  @property {number} changed
  @property {string} idFull
  @property {HTMLElement} el
  @property {BlockData} root
  @property {Array<number>} relPos
  @property {Array<number>} pos
  @property {number} offsetX
  @property {number} offsetY
  @property {Array<number>} size
  @property {NodeEditor} editor
  @property {number} movedStamp id of the last batched `ne-move` this connector
   was part of (P3-2, lets listeners test membership in O(1))
  
  @typedef HTMLConnector_
  @property {ConnectorData} ncData
  @typedef  {HTMLElement & HTMLConnector_} HTMLConnector

  @typedef LinePoint
  @property {Array<number>} pos
  @property {ConnectorData} con
  @property {Array<Function>} listen
  @property {string} align
  
 */

/**
 * Run `fn` at the end of the current task (microtask). Used by the P3-1/P3-2
 * coalescing queues; `queueMicrotask` is everywhere modern, the promise path is
 * only a safety net for environments without it.
 * @param {Function} fn
 */
const microtask = fn =>
  typeof queueMicrotask === 'function' ? queueMicrotask(fn) : Promise.resolve().then(fn)

/**
 *
 */
export class NodeEditor extends JsxW {
  static {
    define('jsx6-nodditor', this)
  }

  /** @type {Array<BlockData>} */
  blocks = []
  /** @type {Array<ConnectLine>} */
  lines = []
  /** @type {ConnectLine} */
  selectedLine
  /** @type {Array<BlockData>} */
  selectedBlocks
  blockMap = new Map()
  nodeMap = new Map()

  /** @type {HTMLElement} */
  currentMenu = null

  /**
   * @param {ConnectorData} con
   */
  newConnector(con) {
    this.lineinteraciton.newConnector(con)
  }

  /**
   * Correctly-spelled alias of the misspelled `lineinteraciton` property.
   * The old name is kept for backward compatibility; a breaking rename to
   * this spelling is planned for v2 (see CHANGELOG).
   * @returns {LineInteraction}
   */
  get lineinteraction() {
    return this.lineinteraciton
  }
  /** @param {LineInteraction} v */
  set lineinteraction(v) {
    this.lineinteraciton = v
  }

  /**
   * Register a block element with the editor.
   *
   * The editor never builds block markup — that is the host's, and it is the reason `typeMap`
   * factories exist. This method takes whatever element the host produced and makes it a block;
   * connectors are then discovered from that markup (`ncid` / `ne-connect`), which is the step that
   * has to happen before any line can refer to them.
   *
   * @param {any} block the block element (or a component with `.el`); any markup the host likes
   * @param {string} id block id; also written to the element as `nid`
   * @param {Object} [param2]
   * @param {Array<number>} [param2.pos] initial content position
   * @param {string} [param2.type] type used by `saveGraph`/`loadGraph`
   * @returns {BlockData}
   */
  add(block, id, { pos = [0, 0], type = '' } = {}) {
    if (this.blockMap.has(id)) throw new Error(`NodeEditor: block id "${id}" is already in use`)
    setAttribute(block, 'nid', id)
    let rootNode = /** @type {HTMLBlock}*/ (toDomNode(block))
    // The element can be the host's own component: hand it the editor so it can react (e.g. render
    // connectors from data after it knows which block it is).
    block.setNodeEditor?.(this)
    // @ts-ignore
    rootNode.nodeEditor = this
    insert(this.contentArea, rootNode)
    /** @type {BlockData} */
    let blockData = (rootNode.neBlock = {
      id,
      type,
      pos: [0, 0],
      size: [0, 0],
      el: rootNode,
      block,
      map: new Map(),
      resizeSet: new Set(),
      connectorMap: new Map(),
      editor: this,
    })
    // accessibility: blocks are focusable groups announced with id/type
    rootNode.setAttribute('role', 'group')
    rootNode.setAttribute('tabindex', '0')
    this.setBlockLabel(blockData, false)
    // P3-1: connector discovery is memoized on "did the block DOM change
    // structurally". A block starts out dirty (its first scan must run); the
    // canvas `MutationObserver` (see `ensureStructObserver`) marks it dirty
    // again whenever connector elements are added or removed inside it.
    blockData.structDirty = true
    this.blocks.push(blockData)
    this.blockMap.set(id, blockData)
    this.nodeMap.set(blockData.el, blockData)
    this.setPos(blockData, pos)
    this.recheckConnectors(blockData)
    this.historyRecord('add')
    return blockData
  }

  /**
   * P3-1: ONE `MutationObserver` for the whole canvas. It resolves each batch of
   * childList records to the block whose DOM actually changed and marks that
   * block dirty, which is what lets `findConnector` skip the subtree walk for
   * every other block (connector discovery is memoized per block).
   * Only `childList` is watched: attribute/style writes (a move, a resize, the
   * `ne-nodrag` marker `findConnector` itself sets) must not look like a
   * structural change.
   */
  ensureStructObserver() {
    if (this._structMO || typeof MutationObserver !== 'function') return
    this._structMO = new MutationObserver(records => {
      records.forEach(r => {
        // Resolve the block whose DOM changed. Two shapes matter:
        //   - the walk from `r.target` finds the block element (`neBlock`) — the common case: a port
        //     was added to or removed from a block that is already registered;
        //   - the walk finds an element carrying `nid` that is not the registered element — the host
        //     REPLACED the block element (re-render), so the new node is adopted. Without it the
        //     block would keep being scanned through the dead element and its ports would stay
        //     undiscovered.
        let blockData = this.resolveBlockForRecord(r)
        if (blockData) {
          blockData.structDirty = true
          this.scheduleConnectorRecheck(blockData)
        }
      })
    })
    this._structMO.observe(this.contentArea, { childList: true, subtree: true })
  }

  /**
   * The `BlockData` a `MutationRecord` belongs to, or `null`.
   *
   * `neBlock` is the normal hit (no attribute read). The `nid` fallback covers a block whose element
   * the host replaced: the registered element is then detached and the new one — which `add` marked
   * with `nid` — has to be adopted, or discovery would keep walking the dead element.
   *
   * @param {MutationRecord} r
   * @returns {BlockData|null}
   */
  resolveBlockForRecord(r) {
    for (let p = r.target; p; p = p.parentElement) {
      if (p.neBlock) return p.neBlock
      // the canvas root must never be treated as a block
      if (p === this.contentArea) break
      let nid = p.getAttribute?.('nid')
      if (nid != null) {
        let blockData = this.blockMap.get(nid)
        if (blockData) return this.adoptBlockElement(blockData, p)
      }
    }
    return null
  }

  /**
   * Point a block at the element that is in the DOM now (the host replaced it), keeping `nodeMap` in
   * sync so `getBlockData(element)` keeps resolving.
   * @param {BlockData} blockData
   * @param {HTMLElement} el
   * @returns {BlockData}
   */
  adoptBlockElement(blockData, el) {
    if (blockData.el !== el) {
      this.nodeMap.delete(blockData.el)
      blockData.el = el
      this.nodeMap.set(el, blockData)
    }
    return blockData
  }

  /**
   * Make the connector set of a block match its DOM again.
   *
   * Memoised by design (P3-1): the subtree is re-walked only when the block is marked structurally
   * dirty — by the canvas `MutationObserver`, or by [add](#add) which starts a block dirty. Pass
   * `force = true` when the caller *knows* the DOM changed outside what the observer can see:
   * a block whose connectors were added while it was **detached** (its mutations were never
   * observed), or a read in the same task as the DOM change, before the observer's microtask ran.
   *
   * @param {BlockData} blockData
   * @param {boolean} [force] walk the subtree even when the block is not marked dirty
   */
  recheckConnectors(blockData, force) {
    if (force) blockData.structDirty = true
    let { resizeSet, cached } = findConnector(blockData)
    if (cached) return
    // Derive the observation set from the connectors that ARE registered, not from what this walk
    // happened to add: a rescan of a block whose connectors were discovered by an earlier walk finds
    // them already in the map, so `findConnector` skips them and returns a set containing only the
    // block root. Installing that would unobserve every connector of the block (no resize tracking),
    // which is what a forced rescan used to do.
    resizeSet = new Set([blockData.el])
    blockData.connectorMap.forEach(con => this.addObservedChain(resizeSet, con.el, blockData.el))
    updateObserver(resizeSet, blockData.resizeSet, this.observer)
    // keep the set we actually installed: it used to stay the empty initial
    // one, so elements that left the block were never unobserved and every
    // scan re-observed the whole subtree
    blockData.resizeSet = resizeSet
  }

  /**
   * Add `el` and every ancestor up to (and including) `root` to `set`.
   *
   * Mirrors `connectorUtil.addResize`: the elements between a connector and its block are the ones
   * whose size can move or resize the endpoint, so they are what the block's `ResizeObserver` has to
   * watch.
   *
   * @param {Set<Element>} set
   * @param {HTMLElement} el
   * @param {HTMLElement} root
   */
  addObservedChain(set, el, root) {
    let node = el
    while (node) {
      set.add(node)
      if (node === root) return
      node = node.parentElement
    }
  }

  /**
   * Re-discover a block's connectors and refresh their positions, reporting the
   * moved ones through the batched `ne-move` queue (P3-2).
   *
   * Memoised: this is what the `ResizeObserver` handler calls for every block
   * in a resize batch, so it must not walk a block whose DOM did not change.
   *
   * @param {BlockData} blockData
   * @param {number} [changeTs] `ResizeObserver` batch stamp to compare
   *   `ConnectorData.changed` against (its connector box changed in this batch)
   */
  refreshBlockConnectors(blockData, changeTs) {
    this.recheckConnectors(blockData)
    blockData.connectorMap.forEach(con => {
      let tmp = con.pos
      recalcPos(con)
      // changed position or size
      if (pairChanged(tmp, con.pos) || (changeTs && con.changed == changeTs)) this.queueMove(con)
    })
  }

  /**
   * P3-1: the DOM of a block changed structurally (its `MutationObserver`
   * fired). Coalesce the burst of mutation records into ONE connector rescan
   * per task, so adding a list of connectors does not walk the subtree once per
   * inserted node.
   * @param {BlockData} blockData
   */
  scheduleConnectorRecheck(blockData) {
    let queue = this._recheckQueue || (this._recheckQueue = new Set())
    queue.add(blockData)
    if (this._recheckScheduled) return
    this._recheckScheduled = true
    microtask(() => {
      this._recheckScheduled = false
      let set = this._recheckQueue
      this._recheckQueue = null
      if (!set || this.destroyed) return
      let changeTs = Date.now()
      set.forEach(b => this.refreshBlockConnectors(b, changeTs))
    })
  }

  /**
   * P3-2: a connector moved. Moved connectors are not reported one event at a
   * time; they are queued and flushed as a single `ne-move` (see `flushMoves`).
   * @param {ConnectorData} con
   */
  queueMove(con) {
    let queue = this._moveQueue || (this._moveQueue = new Set())
    queue.add(con)
    if (this._moveScheduled) return
    this._moveScheduled = true
    // a microtask keeps the flush inside the current frame — lines must not
    // lag a frame behind the blocks — while still coalescing every move of the
    // task (a group drag, a canvas pan, a resize batch) into one event
    microtask(() => this.flushMoves())
  }

  /**
   * Fire the batched `ne-move` for every connector queued since the last flush.
   * One event on the editor element, `detail = { stamp, connectors }`:
   * `connectors` holds the same `{...ConnectorData}` snapshots the old
   * per-connector events carried (same shape, one entry instead of N) and
   * `stamp` is mirrored onto `con.movedStamp` so a listener can check whether
   * one of its connectors moved in O(1). Block-level `ne-move`/`ne-move-done`
   * (see `fireMove`) are unchanged.
   */
  flushMoves() {
    this._moveScheduled = false
    let queue = this._moveQueue
    if (!queue || !queue.size) return
    this._moveQueue = null
    if (this.destroyed) return
    let stamp = (this._moveStamp || 0) + 1
    this._moveStamp = stamp
    let connectors = []
    queue.forEach(con => {
      con.movedStamp = stamp
      connectors.push({ ...con })
    })
    this.fireCustom(this, 'ne-move', { stamp, connectors })
  }

  /**
   *
   * @param {string} id
   * @returns {BlockData}
   */
  getBlockData(id) {
    if (typeof id === 'string') return this.blockMap.get(id)
    if (isNode(id)) return this.nodeMap.get(id)
    return id // assume it is block data
  }

  /**
   *
   * @param {string} nid
   * @returns {Array<number>}
   */
  getPos(nid) {
    return this.blockMap.get(nid)?.pos
  }

  /**
   *
   * @param {string | Array<string>} blockId block id
   * @param {string} [cid] connector id
   * @returns {ConnectorData}
   */
  getConnector(blockId, cid) {
    if (blockId instanceof Array) {
      cid = blockId[1]
      blockId = blockId[0]
    } else if (!cid && blockId.includes('/')) {
      let idx = blockId.indexOf('/')
      cid = blockId.substring(idx + 1)
      blockId = blockId.substring(0, idx)
    }
    return this.blockMap.get(blockId)?.connectorMap.get(cid)
  }

  lineHasConnector(con) {
    for (let i = 0; i < this.lines.length; i++) {
      let tmp = this.lines[i]
      if (tmp.p1.con == con || tmp.p2.con == con) return true
    }
    return false
  }

  removeLine(line) {
    let idx = this.lines.indexOf(line)
    if (idx != -1) {
      if (this.selectedLine == line) this.selectedLine = null
      this.lines.splice(idx, 1)
      remove(line.el)
      finalize(line)
      this.historyRecord('remove')
    }
  }

  /**
   * Remove a connector whose element has been detached from the DOM: drop it
   * from the block data, fire `ne-remove`, remove the lines connected to it
   * (same filter pattern removeBlock used) and finalize its listeners.
   * Idempotent — a second call for the same connector is a no-op, which keeps
   * it safe to run both from the IntersectionObserver callback and from
   * `removeBlock`.
   * @param {ConnectorData} con
   */
  removeConnector(con) {
    let blockData = con?.root
    if (!blockData || blockData.connectorMap.get(con.id) !== con) return
    blockData.connectorMap.delete(con.id)
    blockData.resizeSet.delete(con.el)
    // P3-1: `resizeSet` is the live set the ResizeObserver was fed from, so
    // dropping the element here also releases it (it used to stay observed)
    this.observer?.unobserve?.(con.el)
    // capture the connected lines BEFORE firing `ne-remove`: the listener
    // clears the line endpoints (p.con -> null), so a filter afterwards would
    // match nothing
    let lines = this.lines.filter(
      line => line.p1.con?.idFull == con.idFull || line.p2.con?.idFull == con.idFull,
    )
    this.fireCustom(con.el, 'ne-remove', { ...con })
    lines.forEach(l => this.removeLine(l))
    con.el.removeObserve?.()
    // releases the click finalizer registered in addConnector and, via the
    // recursion into con.el, the pointer finalizers of LineInteraction
    finalize(con)
  }

  removeBlock(block) {
    let idx = this.blocks.indexOf(block)
    if (idx != -1) {
      this.blocks.splice(idx, 1)
      // free the id, otherwise `add` would keep rejecting it as duplicate
      // (and a `clear()` + `loadGraph` round trip could never re-add it)
      this.blockMap.delete(block.id)
      this.nodeMap.delete(block.el)
      block.structDirty = false
      block.connectorMap.forEach(con => this.removeConnector(con))
      // A host may have re-rendered the block by replacing its element (or moved it out of the
      // editor) before asking for the removal; `remove` reads `el.parentElement` and throws on a
      // detached node, which turned teardown into an exception.
      if (block.el.isConnected) remove(block.el)
      finalize(block)
      this.historyRecord('remove')
    }
  }

  getMinXY() {
    return getBlocksMinXY(this.blocks)
  }

  setZoomAndPos(zoom, x, y) {
    this.zoom = zoom
    const [minx, miny] = this.getMinXY()
    this.moveAll(x - minx, y - miny)
  }

  resetView(padx = 30, pady = 30) {
    const [minx, miny] = this.getMinXY()
    this.moveAll(-minx + padx, -miny + pady)
    this.fireMoveDone()
  }

  moveAll(dx = 0, dy = 0) {
    this.blocks.forEach(blockData => {
      let [x, y] = blockData.pos
      this._setPos(blockData, [x + dx, y + dy])
    })
  }

  setPos(nid, pos) {
    let blockData = this.getBlockData(nid)
    if (blockData) this._setPos(blockData, pos)
  }

  _setPos(blockData, pos) {
    blockData.pos = pos
    blockData.connectorMap.forEach(con => {
      updatePos(con)
      // P3-2: queued instead of one `ne-move` per connector per frame
      this.queueMove(con)
    })
    // position is published as CSS variables; `.ne-block` in static/nodditor.css turns them into the
    // transform. No inline declaration is written (see the README's "Styling" section).
    let style = blockData.el.style
    style.setProperty('--ne-x', pos[0] + 'px')
    style.setProperty('--ne-y', pos[1] + 'px')
  }

  // #region zoom-defaults
  /**
   * @param {Object} [param]
   * @param {Function} [param.menu] menu generator, receives the selected blocks (see `menuGenerator`)
   * @param {number} [param.zoomMin] minimum zoom, default 0.3
   * @param {number} [param.zoomMax] maximum zoom, default 4 (zoom beyond 100% is allowed)
   * @param {number} [param.snap] grid size to snap block moves to, 0 = no snapping
   * @param {number} [param.nudgeStep] arrow-key nudge step in content units, Shift multiplies by 5
   * @param {Object<string, Function>} [param.typeMap] block factories, used by `loadGraph` and undo/redo
   */
  tpl({ menu = null, zoomMin = 0.3, zoomMax = 4, snap = 0, nudgeStep = 10, typeMap = null, ...attr } = {}) {
    // #endregion zoom-defaults
    attr.tabindex = '0'
    super.tpl(attr)
    this.menuGenerator = menu
    this.zoomMin = zoomMin
    this.zoomMax = zoomMax
    this.snap = snap
    this.nudgeStep = nudgeStep
    this.typeMap = typeMap
    // undo/redo state (see historyRecord/undo/redo)
    this.undoStack = []
    this.redoStack = []
    this._histLast = null
    this._histKind = null
    this._histTs = 0
    this._batchDepth = 0
    this._loadingGraph = false
    // P3-1/P3-2 state: connectors to report as one batched `ne-move` (see
    // queueMove/flushMoves) and blocks awaiting a connector rescan (see
    // scheduleConnectorRecheck)
    this._moveQueue = null
    this._moveScheduled = false
    this._moveStamp = 0
    this._recheckQueue = null
    this._recheckScheduled = false
    // P3-1: single structural-change detector behind the memoized discovery
    // (`ensureStructObserver` runs below, once `contentArea` exists)
    this._structMO = null
    // @ts-ignore
    this.lineinteraciton = new LineInteraction(this)
    const handler = arr => {
      /** @type {Set<BlockData>} */
      let blocksChanged = new Set()
      /** @type {Set<ConnectorData>} connectors whose OWN box changed */
      let consChanged = new Set()
      let changeTs = Date.now()
      arr.forEach(e => {
        let { target, contentRect, borderBoxSize } = e
        let boxSize = borderBoxSize[0]
        let size = [boxSize.inlineSize, boxSize.blockSize]
        if (e.target == this) {
          this.realWidth = size[0]
          this.realHeight = size[1]
          this.updateSize()
          return
        }

        if (target.ncData) {
          /** @type {ConnectorData} */
          let ncData = target.ncData
          if (pairChanged(size, ncData.size)) {
            // fire change
            ncData.size = size
            ncData.changed = changeTs
            // only this connector moved/grew: its siblings get their own
            // notification when their own box changes, so the block does not
            // have to be recalculated as a whole (P3-1)
            consChanged.add(ncData)
          }
        } else if (target.neBlock) {
          /** @type {BlockData} */
          let neBlock = target.neBlock
          if (pairChanged(size, neBlock.size)) {
            // fire change
            neBlock.size = size
            blocksChanged.add(neBlock)
          }
        } else {
          let neBlock
          let p = target
          while (p && !neBlock) {
            neBlock = p.neBlock
            p = p.parentElement
          }
          if (neBlock) blocksChanged.add(neBlock)
        }
      })
      // P3-1: `refreshBlockConnectors` walks the subtree only for blocks whose
      // DOM changed structurally (their `MutationObserver` set `structDirty`);
      // a plain resize now just recalculates positions.
      blocksChanged.forEach(block => this.refreshBlockConnectors(block, changeTs))
      consChanged.forEach(con => {
        if (blocksChanged.has(con.root)) return // covered by its block
        recalcPos(con)
        // its own box changed: report it (line endpoints depend on `con.size`)
        this.queueMove(con)
      })
    }
    this.observer = new ResizeObserver(handler)
    this.observer.observe(this)
    // The look of the three structural layers (svg line layer, canvas, zoom controls) lives in
    // static/nodditor.css, keyed off these classes. Nothing cosmetic is written inline: see the
    // "Styling" section of the README for the custom properties that drive the dynamic parts
    // (`--ne-zoom`, `--ne-x`, `--ne-y`, `--ne-menu-x`, `--ne-menu-y`).
    this.svgLayer = hSvg('svg', { class: 'ne-svg-layer' })
    // `.ne-canvas`, not `.ne-content`: a block's own body is `.ne-content` (see the block markup), and
    // naming this layer the same made the canvas rule land on the block bodies.
    this.contentArea = <div class="ne-canvas">{this.svgLayer}</div>
    this._zoom = 1
    // P3-1: structural changes of the blocks (added/removed connectors) are
    // tracked by one canvas-wide MutationObserver, which is what the memoized
    // connector discovery keys off
    this.ensureStructObserver()
    // zoom indicator + controls, in the (unscaled) editor corner — see changeZoom*/zoomTo.
    // Stacking is the stylesheet's job (`.ne-zoom-ui` carries `z-index`, see static/nodditor.css):
    // the controls are inserted BEFORE the canvas, and the canvas is a full-size positioned layer, so
    // without an explicit z-index it would paint over them and swallow the clicks.
    // #region zoom-markup
    this.zoomUI = (
      <div class="ne-zoom-ui">
        <div class="ne-zoom-bt" title="Zoom out" onclick={() => this.zoomTo(this.zoom / 1.25)}>
          −
        </div>
        <div class="ne-zoom-bt ne-zoom-val" title="Reset zoom to 100%" onclick={() => this.zoomTo(1)}></div>
        <div class="ne-zoom-bt" title="Zoom in" onclick={() => this.zoomTo(this.zoom * 1.25)}>
          +
        </div>
      </div>
    )
    // #endregion zoom-markup
    this.zoomLabel = this.zoomUI.children[1]
    insert(this, this.zoomUI)
    this.updateZoomUI()
    let el = this.contentArea
    // @ts-ignore
    const { $s } = this
    // create a signal tht tells if editor has focus to work with blocks or lines
    // used to decide if delete will try to delete blocks or lines and for other needs
    this.$focusOrSelecting = $Or($s.isDown, $s.hasFocus)
    observeNow(this.$focusOrSelecting, f => classIf(el, 'focused', f))
    let lx = 0
    let ly = 0
    let domNode
    let nid
    /** @type {BlockData} */
    let blockData
    let ignore
    let downButton = 0
    /** @type {Array<BlockData>} blocks moved together by the current drag (primary first) */
    let dragList = null
    /** @type {Array<Array<number>>} matching `pos` snapshot taken at drag start */
    let dragStart = null
    /** @type {HTMLElement} marquee rectangle while dragging over empty canvas */
    let marqueeEl = null
    let marqueeStart = null
    let marqueeCur = null
    const updateMarquee = () => {
      // geometry is published as CSS custom properties; `.ne-marquee` turns them into left/top/size
      let st = marqueeEl.style
      st.setProperty('--ne-marquee-x', Math.min(marqueeStart[0], marqueeCur[0]) + 'px')
      st.setProperty('--ne-marquee-y', Math.min(marqueeStart[1], marqueeCur[1]) + 'px')
      st.setProperty('--ne-marquee-w', Math.abs(marqueeCur[0] - marqueeStart[0]) + 'px')
      st.setProperty('--ne-marquee-h', Math.abs(marqueeCur[1] - marqueeStart[1]) + 'px')
    }
    // P3-2: pointer events arrive faster than the display refreshes. The drag
    // and the canvas pan keep only the LATEST pending delta and apply it once
    // per animation frame, so a whole group (or the whole canvas) moves — and
    // reports its connectors — once per frame.
    /** pending block-drag offset, applied by `applyDrag` on the next frame */
    let dragRaf = 0
    let dragDelta = null
    /** accumulated canvas-pan offset not yet handed to `moveAll` */
    let panRaf = 0
    let panDelta = null
    /** marquee rectangle update pending for the next frame */
    let marqueeRaf = 0
    const applyDrag = () => {
      if (dragRaf) {
        cancelAnimationFrame(dragRaf)
        dragRaf = 0
      }
      if (!dragDelta) return
      let d = dragDelta
      dragDelta = null
      if (!blockData || !dragList) return
      for (let i = 0; i < dragList.length; i++) {
        this._setPos(dragList[i], [dragStart[i][0] + d[0], dragStart[i][1] + d[1]])
      }
      let menu = this.currentMenu
      if (menu) moveMenu(dragList, menu, this._zoom)
      this.fireMove(blockData)
    }
    const applyPan = () => {
      if (panRaf) {
        cancelAnimationFrame(panRaf)
        panRaf = 0
      }
      if (!panDelta) return
      let d = panDelta
      panDelta = null
      if (d[0] || d[1]) this.moveAll(d[0], d[1])
    }
    /** draw the pending marquee rectangle now (before it is read/removed) */
    const flushMarquee = () => {
      if (!marqueeRaf) return
      cancelAnimationFrame(marqueeRaf)
      marqueeRaf = 0
      if (marqueeEl) updateMarquee()
    }

    el.addEventListener('dragstart', e => {
      if (blockData) e.preventDefault()
    })
    el.addEventListener('pointerdown', e => {
      ignore = false
      if (e.button === 2) {
        // right button: the `contextmenu` listener handles selection + menu
        ignore = true
        return
      }
      let hasDrag
      let hasBlock
      let insideMenu
      domNode = findParent(e.target, p => {
        if (!p.hasAttribute) return false
        if (p.hasAttribute('ne-drag')) hasDrag = true
        if (p.hasAttribute('ne-nodrag')) hasBlock = true
        if (p == this.currentMenu) {
          insideMenu = true
          ignore = true
          return true
        }
        return p.hasAttribute('nid')
      })
      if ((!hasDrag && domNode) || hasBlock || insideMenu) return

      downButton = e.button || 0
      if (domNode) {
        nid = getAttr(domNode, 'nid')
        blockData = this.getBlockData(nid)
      } else {
        blockData = undefined
      }
      if (downButton) e.preventDefault() // middle button: suppress the browser autoscroll
      lx = e.clientX
      ly = e.clientY
      // P3-2: a new gesture starts without leftovers from an unapplied frame
      if (dragRaf) {
        cancelAnimationFrame(dragRaf)
        dragRaf = 0
      }
      if (panRaf) {
        cancelAnimationFrame(panRaf)
        panRaf = 0
      }
      if (marqueeRaf) {
        cancelAnimationFrame(marqueeRaf)
        marqueeRaf = 0
      }
      dragDelta = null
      panDelta = null
      $s.isDown = true
    })

    el.addEventListener('pointerup', e => {
      if (ignore) {
        ignore = false
        return
      }
      if (!$s.isDown()) {
        this.deselect()
        return
      }
      let wasMoving = $s.isMoving()
      $s.isDown = false
      if (wasMoving) el.releasePointerCapture(e.pointerId)
      $s.isMoving = false
      // P3-2: land the last frame's pending movement BEFORE ending the move, so
      // `fireMoveDone` (and the undo snapshot it records) sees the final positions
      applyDrag()
      applyPan()
      flushMarquee()
      this.fireMoveDone(blockData, marqueeEl ? 'select' : 'move')

      if (wasMoving && marqueeEl) {
        // finish the marquee: select every block its rectangle intersects
        let [mx, my] = this.contentPoint(e.clientX, e.clientY)
        let hit = this.blocksInRect(marqueeStart[0], marqueeStart[1], mx, my)
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          hit = [...(this.selectedBlocks || [])]
          this.blocksInRect(marqueeStart[0], marqueeStart[1], mx, my).forEach(b => {
            if (!hit.includes(b)) hit.push(b)
          })
        }
        this.selectBlocks(hit)
        e.preventDefault()
      } else if (wasMoving) {
        e.preventDefault()
      } else if (domNode == null) {
        // pointer was not on a block/line and no movement occurred: deselect
        this.deselect()
      } else if (blockData) {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          // multi-select: toggle the block in the current selection
          this.toggleBlockSelection(blockData)
        } else {
          this.selectBlocks([blockData])
        }
      }
      if (marqueeEl) {
        remove(marqueeEl)
        marqueeEl = null
      }
      blockData = domNode = nid = undefined
      dragList = dragStart = null
      //this.focus()
    })

    el.addEventListener('pointermove', e => {
      if (ignore) return
      if (!$s.isDown()) return

      if (!$s.isMoving()) {
        // pointer capture inside pointerdown caused clicking to not work
        // it is better to capture pointer only on pointer down + first movement
        el.setPointerCapture(e.pointerId)
        $s.isMoving = true
        if (blockData) {
          let sel = this.selectedBlocks || []
          if (sel.includes(blockData)) {
            // dragging a member of a multi-selection moves the whole group
            dragList = [blockData, ...sel.filter(b => b != blockData)]
          } else {
            this.selectBlocks([blockData])
            dragList = [blockData]
          }
          dragStart = dragList.map(b => [b.pos[0], b.pos[1]])
        } else {
          let menu = this.currentMenu
          if (menu) setVisible(menu, false)
          if (downButton === 0 && !e.altKey && !e.ctrlKey && !e.metaKey) {
            // left drag over empty canvas: marquee select (pan with middle button or Alt+drag)
            marqueeStart = this.contentPoint(lx, ly) // lx/ly = pointerdown client pos
            marqueeCur = [...marqueeStart]
            // The look and the stacking come from `.ne-marquee` in static/nodditor.css and its
            // geometry from `--ne-marquee-*`; nothing is set inline. The marquee is inserted as a
            // sibling AFTER the blocks, so the stylesheet's `z-index` is what keeps it above them.
            marqueeEl = <div class="ne-marquee"></div>
            insert(this.contentArea, marqueeEl)
            updateMarquee()
          }
        }
        window.getSelection().removeAllRanges()
        this.focus()
      }
      if (blockData) {
        let [x0, y0] = dragStart[0]
        let nx = x0 + (-lx + e.clientX) / this._zoom
        let ny = y0 + (-ly + e.clientY) / this._zoom
        if (this.snap) {
          // optional grid snapping (editor.snap / tpl `snap`)
          nx = Math.round(nx / this.snap) * this.snap
          ny = Math.round(ny / this.snap) * this.snap
        }
        // P3-2: keep the latest offset and apply it once on the next frame
        dragDelta = [nx - x0, ny - y0]
        if (!dragRaf)
          dragRaf = requestAnimationFrame(() => {
            dragRaf = 0
            applyDrag()
          })
      } else if (marqueeEl) {
        // P3-2: the marquee is a layout read + style write: do it once per frame
        marqueeCur = this.contentPoint(e.clientX, e.clientY)
        if (!marqueeRaf)
          marqueeRaf = requestAnimationFrame(() => {
            marqueeRaf = 0
            updateMarquee()
          })
      } else {
        let dx = (-lx + e.clientX) / this._zoom
        let dy = (-ly + e.clientY) / this._zoom
        lx = e.clientX
        ly = e.clientY
        if (!panDelta) panDelta = [0, 0]
        panDelta[0] += dx
        panDelta[1] += dy
        if (!panRaf)
          panRaf = requestAnimationFrame(() => {
            panRaf = 0
            applyPan()
          })
      }
    })

    el.addEventListener('contextmenu', e => {
      // right-click: open the selection menu at the cursor instead of only
      // when the block/line is selected with the pointer
      e.preventDefault()
      if (this.currentMenu && findParent(e.target, p => p == this.currentMenu)) return
      let node = findParent(e.target, p => p.hasAttribute && p.hasAttribute('nid'))
      if (node) {
        let bd = this.getBlockData(getAttr(node, 'nid'))
        if (!bd) return
        if (!(this.selectedBlocks || []).includes(bd)) this.selectBlocks([bd])
        this.placeMenuAtCursor(e)
        return
      }
      let g = findParent(e.target, p => p.tagName == 'g')
      let line = g && this.lines.find(l => l.el == g)
      if (line) {
        this.selectConnector(line)
        let menu = this.menuGenerator?.([])
        if (menu) {
          if (this.currentMenu && this.currentMenu != menu) setVisible(this.currentMenu, false)
          setVisible(menu, true)
          if (!menu.parentNode) {
            insert(this.contentArea, menu)
          }
          this.currentMenu = menu
          this.placeMenuAtCursor(e)
        }
        return
      }
      // right-click over empty canvas: clear the selection
      this.deselect()
    })
    const keypress = e => {
      // while the user is editing an in-place title (contenteditable),
      // Delete/Backspace must type, not delete the selection
      let active = document.activeElement
      if (active && active.isContentEditable) return
      let key = e.key
      let mod = e.ctrlKey || e.metaKey
      if (mod) {
        switch (key.toLowerCase()) {
          case 'z':
            e.preventDefault()
            if (e.shiftKey) this.redo()
            else this.undo()
            return
          case 'y':
            e.preventDefault()
            this.redo()
            return
          case 'a':
            e.preventDefault()
            this.selectAll()
            return
          case '=':
          case '+':
            e.preventDefault()
            this.zoomTo(this.zoom * 1.25)
            return
          case '-':
          case '_':
            e.preventDefault()
            this.zoomTo(this.zoom / 1.25)
            return
          case '0':
            e.preventDefault()
            this.zoomTo(1)
            return
        }
      } else if (key === 'Escape') {
        this.deselect()
        return
      } else if (key === 'Enter' || key === ' ') {
        // keyboard-only selection: Enter/Space on a focused block or line
        let bd = e.target !== this ? this.getBlockData(e.target) : null
        if (bd) {
          this.selectBlocks([bd])
          e.preventDefault()
          return
        }
        let g = findParent(e.target, p => p.tagName == 'g')
        let line = g && this.lines.find(l => l.el == g)
        if (line) {
          this.selectConnector(line)
          e.preventDefault()
        }
        return
      }
      if ((key === 'Delete' || key === 'Backspace') && this.$focusOrSelecting()) {
        this.deleteSelection()
        e.preventDefault()
        return
      }
      if (this.$focusOrSelecting()) {
        // arrow-key nudge of the selection (Shift = coarse step)
        let dx = key == 'ArrowLeft' ? -1 : key == 'ArrowRight' ? 1 : 0
        let dy = key == 'ArrowUp' ? -1 : key == 'ArrowDown' ? 1 : 0
        if (dx || dy) {
          e.preventDefault()
          let step = this.nudgeStep * (e.shiftKey ? 5 : 1)
          this.nudgeSelection(dx * step, dy * step)
        }
      }
    }
    listen(this, 'keydown', keypress)
    this.onfocus = e => ($s.hasFocus = true)
    this.onblur = e => ($s.hasFocus = false)
    // blocks and lines are tabbable — keep `hasFocus` true while the focus
    // is on a descendant of the editor
    listen(this, 'focusin', () => ($s.hasFocus = true))
    listen(this, 'focusout', e => {
      if (!this.contains(e.relatedTarget)) $s.hasFocus = false
    })
    return this.contentArea
  }

  get zoom() {
    return this._zoom
  }

  set zoom(zoom) {
    zoom = this.clampZoom(zoom)
    if (this._zoom == zoom) return
    this._zoom = zoom
    this.contentArea.style.setProperty('--ne-zoom', String(zoom))
    this.updateSize()
    this.updateZoomUI()
  }

  updateSize() {
    let style = this.contentArea.style
    style.setProperty('--ne-zoom-w', this.realWidth / this._zoom + 'px')
    style.setProperty('--ne-zoom-h', this.realHeight / this._zoom + 'px')
  }

  changeZoomMouse(zoom, e) {
    const rect = this.getBoundingClientRect()
    this.changeZoom(zoom, e.clientX - rect.x, e.clientY - rect.y)
  }
  changeZoomCenter(zoom) {
    this.changeZoom(zoom, this.realWidth / 2, this.realHeight / 2)
  }

  changeZoom(delta, x = 0, y = 0) {
    const recenter = !!x || !!y
    let zoom = this._zoom
    let relx, rely
    if (recenter) {
      relx = x / zoom
      rely = y / zoom
    }

    let newZoom = this.clampZoom(zoom + delta)
    if (newZoom != zoom) {
      if (recenter) {
        let relx2 = x / newZoom
        let rely2 = y / newZoom
        this.moveAll(relx2 - relx, rely2 - rely)
        this.fireMoveDone(null, 'zoom')
      }
      this.zoom = newZoom
    }
  }

  /**
   * Clamp a zoom value into the `[zoomMin, zoomMax]` range. Values within
   * float dust (1e-9) of a bound snap to it, so accumulated wheel steps land
   * exactly on `zoomMin`/`zoomMax`.
   * @param {number} zoom
   * @returns {number}
   */
  clampZoom(zoom) {
    let lo = this.zoomMin
    let hi = this.zoomMax
    if (zoom <= lo || zoom - lo < 1e-9) return lo
    if (zoom >= hi || hi - zoom < 1e-9) return hi
    return zoom
  }

  /**
   * Zoom to an absolute level (clamped to `zoomMin`/`zoomMax`), centered on the
   * middle of the editor. Used by the zoom controls and Ctrl+/-/0 keys.
   * @param {number} zoom
   */
  zoomTo(zoom) {
    this.changeZoomCenter(this.clampZoom(zoom) - this._zoom)
  }

  updateZoomUI() {
    if (this.zoomLabel) this.zoomLabel.textContent = Math.round(this._zoom * 100) + '%'
    if (this.zoomUI) {
      classIf(this.zoomUI, 'at-min', this._zoom <= this.zoomMin)
      classIf(this.zoomUI, 'at-max', this._zoom >= this.zoomMax)
    }
  }

  clear() {
    this.deleteBlocks([...this.blocks])
    this.selectBlocks([])
  }
  deleteSelectedBlocks() {
    this.deleteBlocks([...this.selectedBlocks])
    this.selectBlocks([])
  }
  deleteBlocks(blocks) {
    // batch the removals into ONE undo entry (`historyRecord` is deferred
    // until the outermost batched call finishes)
    this._batchDepth++
    try {
      blocks.forEach(block => {
        this.removeBlock(block)
      })
    } finally {
      this._batchDepth--
      if (!this._batchDepth) this.historyRecord('remove')
    }
  }
  /**
   * @param {string} idFull1
   * @param {string} idFull2
   * @returns {boolean} true when a line already connects the two connectors (in either direction)
   */
  lineExists(idFull1, idFull2) {
    for (let i = 0; i < this.lines.length; i++) {
      let tmp = this.lines[i]
      let a = tmp.p1.con?.idFull
      let b = tmp.p2.con?.idFull
      if ((a == idFull1 && b == idFull2) || (a == idFull2 && b == idFull1)) return true
    }
    return false
  }

  /**
   * @param {string|Array<string>} c1
   * @param {string|Array<string>} c2
   * @returns {ConnectLine}
   * @throws {Error} when either connector is unknown, they are the same connector,
   *   or a line already connects the pair (in either direction)
   */
  addConnectorFromTo(c1, c2) {
    let con1 = this.getConnector(c1)
    let con2 = this.getConnector(c2)
    // A host that renders a block's connectors itself (data-driven blocks) can legitimately call
    // this in the same task as the DOM change, before the canvas `MutationObserver` has marked the
    // block dirty. Give the two blocks involved one forced rescan each before giving up: it only
    // happens on the failure path, so the happy path stays allocation-free.
    if (!con1) con1 = this.getConnectorAfterRescan(c1)
    if (!con2) con2 = this.getConnectorAfterRescan(c2)
    if (!con1 || !con2) throw new Error(`NodeEditor: ${this.describeMissingConnector(c1, con1, c2, con2)}`)
    if (con1 == con2) throw new Error(`NodeEditor: cannot connect a connector to itself: "${con1.idFull}"`)
    if (this.lineExists(con1.idFull, con2.idFull))
      throw new Error(`NodeEditor: "${con1.idFull}" is already connected to "${con2.idFull}"`)
    let path = new ConnectLine()
    path.setPoint1(con1, false)
    path.setPoint2(con2)
    let con = this.addConnector(path)
    this.historyRecord('line')
    return con
  }

  /**
   * Look a connector up again after forcing a rescan of the block it belongs to.
   *
   * Used only when a plain lookup failed, so a host that renders connectors asynchronously (or in
   * the same task as the lookup) still gets its lines. The id is `"blockId/ncid"`; an array or an
   * object form has no block name to rescan and is left to the caller's error.
   *
   * @param {string|Array<string>} ref
   * @returns {ConnectorData | undefined}
   */
  getConnectorAfterRescan(ref) {
    if (typeof ref !== 'string' || !ref.includes('/')) return undefined
    let blockId = ref.slice(0, ref.indexOf('/'))
    let blockData = this.blockMap.get(blockId)
    if (!blockData) return undefined
    this.recheckConnectors(blockData, true)
    return this.getConnector(ref)
  }

  /**
   * Explain why a block's connectors are (or are not) discovered.
   *
   * Walks the block element for `[ncid]` exactly like discovery does and reports, per element, the
   * `ncid`, the direction, and whether the editor collected it — plus why not, when it did not.
   * Intended for the common "my connector does not show up" case: the usual causes are an `ncid`
   * inside a shadow root (never traversed), a connector element outside the block element, and a
   * **duplicate `ncid`** (only the first element with an id becomes the connector; the second is
   * ignored and also does not get the `ne-nodrag` marker, so it drags the block instead).
   *
   * @param {string|BlockData} block
   * @returns {Array<{ ncid: string|null, collected: boolean, dir: string|null, tag: string, note?: string }>}
   */
  explainConnectors(block) {
    let blockData = this.getBlockData(block)
    if (!blockData) return []
    let found = []
    let walk = el => {
      let ncid = getAttr(el, 'ncid')
      if (ncid) {
        let collected = blockData.connectorMap.get(ncid)?.el === el
        let note
        if (!collected && blockData.connectorMap.has(ncid)) note = 'duplicate ncid — another element holds it'
        else if (!collected) note = 'not collected by the last scan'
        found.push({
          ncid: typeof ncid === 'string' ? ncid : String(ncid),
          collected,
          dir: getAttr(el, 'ne-connect'),
          tag: el.tagName,
          ...(note ? { note } : {}),
        })
      }
      for (let child = el.firstElementChild; child; child = child.nextElementSibling) walk(child)
    }
    walk(blockData.el)
    return found
  }

  /**
   * Build the "connector not found" message.
   *
   * A bare `unknown connector: "1/o1"` does not say *why*, and the usual cause is host-side: the
   * block's markup has not rendered its connectors yet (or it renders them with a different `ncid`).
   * So the message names the block, lists the connectors that WERE discovered, and says whether the
   * block exists at all.
   *
   * @param {string|Array<string>} c1
   * @param {ConnectorData|undefined} con1
   * @param {string|Array<string>} c2
   * @param {ConnectorData|undefined} con2
   * @returns {string}
   */
  describeMissingConnector(c1, con1, c2, con2) {
    let parts = []
    for (const [ref, con] of [
      [c1, con1],
      [c2, con2],
    ]) {
      if (con) continue
      let name = Array.isArray(ref) ? ref.join('/') : String(ref)
      let blockId = typeof ref === 'string' && ref.includes('/') ? ref.slice(0, ref.indexOf('/')) : null
      let blockData = blockId ? this.blockMap.get(blockId) : null
      if (blockData) {
        let known = [...blockData.connectorMap.keys()]
        parts.push(
          `"${name}" does not exist in block "${blockData.id}" (type "${blockData.type}"); ` +
            `discovered there: ${known.length ? known.map(k => `"${k}"`).join(', ') : 'none'}`,
        )
      } else {
        parts.push(`"${name}" does not exist (no block "${blockId ?? '?'}" registered)`)
      }
    }
    return `unknown connector: ${parts.join('; ')}`
  }
  /**
   * Re-attach the lines that use a connector whose ELEMENT was replaced (see `findConnector`).
   *
   * A line holds its endpoint as a `ConnectorData` object plus listeners bound to
   * `con.el` (`ne-remove` in `ConnectLine.setPoint`), and a `ne-move` subscription per endpoint. When
   * a host re-renders a port — the usual data-driven flow, where blocks are added first and their
   * ports arrive with the async data — the old listeners die with the old element, so the lines must
   * be re-pointed at the same `ConnectorData` (its `el` has already been updated in place).
   *
   * Idempotent: `setPoint` releases the previous listeners before installing new ones.
   *
   * @param {ConnectorData} con
   */
  reattachLines(con) {
    this.lines.forEach(line => {
      if (line.p1.con === con) line.setPoint(line.p1, con, true)
      if (line.p2.con === con) line.setPoint(line.p2, con, true)
    })
  }

  /**
   * @param {ConnectLine} con
   */
  addConnector(con) {
    listenUntil(con, con.el, 'click', e => {
      this.selectConnector(con)
    })
    insert(this.svgLayer, con.el)
    this.lines.push(con)
    return con
  }

  /**
   * @typedef GraphState
   * @property {Array<{id: string, type: string, pos: Array<number>}>} blocks
   * @property {Array<[string, string]>} lines
   */

  /**
   * Serialize the whole graph to a plain JSON-compatible object: `blocks` as
   * `{id, type, pos}` and `lines` as pairs of connector ids
   * (`ConnectorData.idFull`, `"blockId/ncid"`). The result is suitable for
   * `JSON.stringify` (the demo stores it in `localStorage`).
   * @returns {GraphState}
   */
  saveGraph() {
    return {
      // pos arrays are COPIED: undo/redo keeps snapshots of live block data
      blocks: this.blocks.map(b => ({ id: b.id, type: b.type, pos: [b.pos[0], b.pos[1]] })),
      lines: this.lines.map(l => [l.p1.con?.idFull, l.p2.con?.idFull]),
    }
  }

  /**
   * Rebuild the graph from a saved state (as produced by `saveGraph`),
   * clearing the editor first.
   *
   * `typeMap` maps a block `type` to a factory **that receives the block's own data** and returns a
   * FRESH block element: `{ Switch: ({ id, type, ...data }) => <Switch id={id} {...data} /> }`. The
   * editor does not know block components itself, and it never builds block markup — rendering it
   * from the provided data is the host's job, which is why the descriptor is passed through.
   * Extra keys on a block entry arrive in the factory untouched (a host that needs custom per-block
   * data can put it there and read it back in the factory).
   *
   * Lines are wired **after** every block has been added, so a factory that renders connectors
   * synchronously gets them discovered before any line refers to them. A factory that renders
   * asynchronously must be awaited by the host: load blocks first, then call
   * [inspectConnectors](#inspectConnectors), then add the lines (see the README).
   *
   * **Bad line entries are skipped, not fatal** — see [loadLines](#loadLines): each one is reported
   * to the console and the remaining lines still attach, so corrupt data cannot blank a document.
   *
   * The undo/redo baseline is reset afterwards: loading is not an "edit".
   *
   * @param {GraphState} state
   * @param {Object<string, Function>} [typeMap]
   * @throws {Error} when a block type has no factory in `typeMap`
   */
  loadGraph(state, typeMap = this.typeMap) {
    this._loadingGraph = true
    try {
      this.clear()
      for (let b of state?.blocks ?? []) {
        let make = typeMap?.[b.type]
        if (typeof make !== 'function')
          throw new Error(`NodeEditor: no factory registered for block type "${b.type}" (id "${b.id}")`)
        // the factory gets the whole block entry: it renders the markup from the provided data
        this.add(make(b), b.id, { pos: [b.pos[0], b.pos[1]], type: b.type })
      }
      this.inspectConnectors()
      this.loadLines(state?.lines)
    } finally {
      this._loadingGraph = false
    }
    this.historyReset()
  }

  /**
   * Wire the lines of a loaded graph, tolerating bad entries.
   *
   * One line that cannot be attached (a connector the block markup does not have, a duplicate, a
   * self-connection) must not cost the whole document: the editor reports it to the console with the
   * same detail as the strict error and continues with the remaining lines. That matters for
   * data-driven diagrams, where the block markup comes from the host and stale or corrupt line data
   * is a normal occurrence.
   *
   * `addConnectorFromTo` stays strict on purpose: it is also the interactive path (a host wiring one
   * line from user input), where failing loudly is the right behaviour.
   *
   * @param {Array<[string, string]>} [lines]
   * @returns {{ attached: number, skipped: number }}
   */
  loadLines(lines) {
    let attached = 0
    let skipped = 0
    for (let entry of lines ?? []) {
      let [c1, c2] = Array.isArray(entry) ? entry : [undefined, undefined]
      try {
        this.addConnectorFromTo(c1, c2)
        attached++
      } catch (err) {
        skipped++
        console.error(`NodeEditor: skipping line ${JSON.stringify(entry)} — ${err.message}`)
      }
    }
    return { attached, skipped }
  }

  /**
   * Inspect the rendered blocks and (re)discover their connectors.
   *
   * This is the explicit middle step of the data-driven flow: the host renders the block markup from
   * its data, calls this, and only then wires lines — so the connectors are guaranteed to be in the
   * map no matter how the markup was produced. Every block is force-scanned, so it is safe to call
   * after an asynchronous render as well.
   *
   * @returns {Array<{ blockId: string, id: string, idFull: string, dir: string, el: HTMLElement }>}
   *   every connector currently discovered, in block order
   */
  inspectConnectors() {
    let found = []
    this.blocks.forEach(blockData => {
      this.recheckConnectors(blockData, true)
      blockData.connectorMap.forEach(con => {
        found.push({ blockId: blockData.id, id: con.id, idFull: con.idFull, dir: con.dir, el: con.el })
      })
    })
    return found
  }

  /**
   * The connectors discovered in one block, as `id -> ConnectorData`.
   *
   * Use it to validate host data before wiring lines (`editor.getConnectors(id).has('o1')`), or to
   * build a connector list for the user.
   *
   * @param {string|BlockData} block id or `BlockData`
   * @returns {Map<string, ConnectorData>}
   */
  getConnectors(block) {
    let blockData = this.getBlockData(block)
    return blockData ? blockData.connectorMap : new Map()
  }

  /**
   * Undo/redo snapshots reuse the P1 `{blocks, lines}` serialization.
   * `historyRecord` runs on the mutating events (`add`, `removeBlock`,
   * `removeLine`, `addConnectorFromTo`, `fireMoveDone`, line-connect): it
   * snapshots the CURRENT graph and only pushes an undo entry when the
   * snapshot actually differs from the previous one. `kind` merges rapid
   * sequences (wheel zoom steps, key-repeat nudges) into a single undo step.
   * @param {string} kind
   */
  historyRecord(kind = 'change') {
    if (this.destroyed || this._loadingGraph || this._batchDepth > 0) return
    let state = this.saveGraph()
    let ser = JSON.stringify(state)
    if (this._histLast) {
      if (ser == this._histLast.ser) return
      let merge =
        kind == this._histKind && (kind == 'zoom' || kind == 'nudge') && Date.now() - this._histTs < 750
      if (!merge) {
        this.undoStack.push(this._histLast)
        if (this.undoStack.length > 100) this.undoStack.shift()
        this.redoStack.length = 0
      }
    }
    this._histLast = { state, ser }
    this._histKind = kind
    this._histTs = Date.now()
  }

  /** Set the recorded snapshot baseline to the current graph (creates no undo entry). */
  historyReset() {
    let state = this.saveGraph()
    this._histLast = { state, ser: JSON.stringify(state) }
    this._histKind = null
    this._histTs = 0
  }

  /**
   * Undo the last recorded change. Restoring reuses `loadGraph`, so the
   * editor needs its `typeMap` (block factories).
   * @returns {boolean} false when there is nothing to undo or `typeMap` is missing
   */
  undo() {
    if (!this.undoStack.length) return false
    if (!this.typeMap) {
      console.warn('NodeEditor: undo() requires editor.typeMap to rebuild blocks')
      return false
    }
    this.redoStack.push(this._histLast)
    this._histLast = this.undoStack.pop()
    this._histKind = null
    this.loadGraph(this._histLast.state, this.typeMap)
    return true
  }

  /**
   * Redo the last undone change (see `undo` for the `typeMap` requirement).
   * @returns {boolean}
   */
  redo() {
    if (!this.redoStack.length) return false
    if (!this.typeMap) {
      console.warn('NodeEditor: redo() requires editor.typeMap to rebuild blocks')
      return false
    }
    this.undoStack.push(this._histLast)
    this._histLast = this.redoStack.pop()
    this._histKind = null
    this.loadGraph(this._histLast.state, this.typeMap)
    return true
  }
  /**
   *
   * @param {*} blocks
   */

  selectBlocks(blocks) {
    this.selectedBlocks = blocks
    let old = this.currentMenu
    let menu
    let blockIdMap = {}
    if (blocks.length) {
      blocks.forEach(b => {
        blockIdMap[b.id] = 1
      })
      this.selectConnector(null)
      /** @type {HTMLElement} */
      menu = this.menuGenerator?.(blocks)
      if (old && old != menu) setVisible(old, false)
      if (menu) {
        setVisible(menu, true)
        if (menu != old) {
          insert(this.contentArea, menu)
        }
        moveMenu(blocks, menu, this._zoom)
      }
    } else {
      if (old) setVisible(old, false)
    }
    this.currentMenu = menu
    // P3-3: O(1) membership test (was `blocks.includes(p)` per block, i.e.
    // O(selection × blocks) on every selection change)
    let selSet = new Set(blocks)
    this.blocks.forEach(p => {
      /** @type {Element|any} */
      let block = p.block
      let sel = selSet.has(p)
      if (block.setSelected) {
        block.setSelected(sel)
      } else {
        setSelected(block, sel)
      }
      this.setBlockLabel(p, sel)
    })
    this.lines.forEach(l => {
      classIf(l.el, 'ne-from-sel-block', blockIdMap[l.p1.con?.root.id])
      classIf(l.el, 'ne-to-sel-block', blockIdMap[l.p2.con?.root.id])
    })
  }

  selectConnector(con) {
    if (con) this.selectBlocks([])
    this.selectedLine = con
    this.lines.forEach(p => {
      p.setSelected(p == con)
    })
    //this.focus()
  }

  deselect() {
    this.selectConnector()
    this.selectBlocks([])
  }

  /**
   * Shift/Ctrl-click support: toggle one block in the selection.
   * @param {BlockData} block
   */
  toggleBlockSelection(block) {
    let list = (this.selectedBlocks || []).slice()
    let idx = list.indexOf(block)
    if (idx >= 0) list.splice(idx, 1)
    else list.push(block)
    this.selectBlocks(list)
  }

  /** Select all blocks (Ctrl+A). */
  selectAll() {
    this.selectBlocks([...this.blocks])
  }

  /** Delete the current selection: the selected line, or the selected blocks. */
  deleteSelection() {
    if (this.selectedLine) {
      this.removeLine(this.selectedLine)
    } else if (this.selectedBlocks?.length) {
      this.deleteSelectedBlocks()
    }
  }

  /**
   * All blocks whose rectangle INTERSECTS the given content-space rectangle
   * (marquee selection: touching counts as inside).
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @returns {Array<BlockData>}
   */
  blocksInRect(x1, y1, x2, y2) {
    let minx = Math.min(x1, x2)
    let maxx = Math.max(x1, x2)
    let miny = Math.min(y1, y2)
    let maxy = Math.max(y1, y2)
    return this.blocks.filter(b => {
      let [w, h] = b.size
      return b.pos[0] < maxx && b.pos[0] + w > minx && b.pos[1] < maxy && b.pos[1] + h > miny
    })
  }

  /**
   * Viewport (client) coordinates to content-area coordinates (zoom-aware).
   * @param {number} clientX
   * @param {number} clientY
   * @returns {Array<number>}
   */
  contentPoint(clientX, clientY) {
    let rect = this.getBoundingClientRect()
    return [(clientX - rect.x) / this._zoom, (clientY - rect.y) / this._zoom]
  }

  /**
   * Move the selection by (dx, dy) content units, applying grid snapping
   * relative to the primary block when `snap` is on.
   * @param {number} dx
   * @param {number} dy
   */
  nudgeSelection(dx, dy) {
    let sel = this.selectedBlocks
    if (!sel?.length) return
    let [x0, y0] = sel[0].pos
    let nx = x0 + dx
    let ny = y0 + dy
    if (this.snap) {
      nx = Math.round(nx / this.snap) * this.snap
      ny = Math.round(ny / this.snap) * this.snap
    }
    dx = nx - x0
    dy = ny - y0
    sel.forEach(b => this._setPos(b, [b.pos[0] + dx, b.pos[1] + dy]))
    this.fireMoveDone(sel[0], 'nudge')
  }

  /**
   * Position the current selection menu at a client point (right-click opens
   * the menu at the cursor instead of above the block).
   * @param {MouseEvent} e
   */
  placeMenuAtCursor(e) {
    let menu = this.currentMenu
    if (!menu) return
    setVisible(menu, true)
    let [x, y] = this.contentPoint(e.clientX, e.clientY)
    menu.style.setProperty('--ne-menu-x', x + 'px')
    menu.style.setProperty('--ne-menu-y', y + 'px')
  }

  /**
   * Accessible NAME of a block: type + id, and nothing else.
   *
   * The name must not change with selection. An earlier version appended `" selected"` here, which
   * made the block's accessible name change on every click — an `aria-label` is a name, not a place
   * for state, and selection is already carried by the `selected` attribute. The `selected` argument
   * is still accepted so existing callers do not have to change.
   *
   * @param {BlockData} blockData
   * @param {boolean} [selected] ignored — kept for call-site compatibility
   */
  setBlockLabel(blockData, selected) {
    let { id, type, el } = blockData
    void selected
    el.setAttribute('aria-label', `${type || 'block'} ${id}`)
  }

  /**
   * Kept as a no-op for backward compatibility.
   *
   * It used to write a selection message ("block 1 selected", "selection cleared") into an
   * `aria-live` region that the editor inserted into itself. That region was only visually hidden by
   * the stylesheet, so a host that did not load it got the sentence as literal text on the canvas —
   * and the announcements themselves were never requested. Selection is conveyed by the `selected`
   * attribute/stroke.
   *
   * @param {string} [msg] ignored
   */
  setAriaStatus(msg) {
    void msg
  }

  /** @type {boolean} */
  destroyed = false

  /**
   * Tear down the editor: disconnect the canvas ResizeObserver, finalize all
   * lines and blocks (their listeners) and drop the selection. Idempotent —
   * safe to call again; also called automatically when the element leaves
   * the DOM (see `disconnectedCallback`).
   */
  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    // iterate backwards: removeLine/removeBlock splice the very arrays we
    // are walking, so a forward forEach would skip every second entry
    for (let i = this.lines.length - 1; i >= 0; i--) this.removeLine(this.lines[i])
    for (let i = this.blocks.length - 1; i >= 0; i--) this.removeBlock(this.blocks[i])
    this.selectedLine = null
    this.selectedBlocks = []
    // P3-4: the menu box cache lives on the menu element with its own
    // MutationObserver — release it before dropping the reference
    let menu = this.currentMenu
    if (menu) {
      menu._neMenuObs?.disconnect()
      menu._neMenuObs = null
      menu._neMenuSize = null
    }
    this.currentMenu = null
    this.observer?.disconnect()
    // P3-1: stop tracking structural changes
    this._structMO?.disconnect()
    this._structMO = null
    // P3-1/P3-2: drop the pending coalesced work (the queued callbacks check
    // `destroyed`, but the objects they hold must go too)
    this._moveQueue = null
    this._moveScheduled = false
    this._recheckQueue = null
    this._recheckScheduled = false
    this.undoStack.length = 0
    this.redoStack.length = 0
    this._histLast = null
  }

  /**
   * The editor was attached to the document.
   *
   * Forces one connector rescan per block. A block's DOM can legitimately change **while it is
   * detached** — a component that fills in its connectors during construction, or a host that
   * builds the whole graph first and attaches the editor afterwards. Those mutations were never
   * observed (the canvas `MutationObserver` watches `contentArea`, and a disconnected tree reports
   * nothing), so the memoised scan would keep the block's connector set empty forever and every
   * line referring to it would fail with "unknown connector" — for a graph loaded before mounting.
   *
   * One walk per block, once, on attach; the memoisation is untouched after that.
   */
  connectedCallback() {
    super.connectedCallback?.()
    if (this.destroyed || !this.blocks?.length) return
    this.blocks.forEach(blockData => {
      try {
        this.recheckConnectors(blockData, true)
      } catch (err) {
        // never let a rescan break mounting: a host can still force one later
        console.error('NodeEditor: connector rescan on connect failed', err)
      }
    })
  }

  /**
   * The custom element was removed from the DOM — release everything it
   * holds (the canvas ResizeObserver is never disconnected otherwise).
   */
  disconnectedCallback() {
    super.disconnectedCallback?.()
    this.destroy()
  }

  /**
   *
   * @param {Element} el
   * @param {string} name
   * @param {*} [detail]
   */
  fireCustom(el, name, detail = {}) {
    fireCustom(el, name, detail)
    if (el != this) fireCustom(this, name, detail)
  }

  /**
   * Signal the end of a move/edit: fires `ne-move-done` (the demo persists on
   * it) and records the undo/redo snapshot. `kind` groups rapid consecutive
   * changes (see `historyRecord`), `'move'` never merges.
   * @param {BlockData} [blockData]
   * @param {string} [kind]
   */
  fireMoveDone(blockData, kind = 'move') {
    this.fireMove(blockData, 'ne-move-done')
    this.historyRecord(kind)
    let menu = this.currentMenu
    if (menu) {
      setVisible(menu, true)
      // P3-4: re-show and reposition in the SAME frame. The `setTimeout` used to
      // postpone this because `moveMenu` had to measure the menu (a forced
      // layout); `moveMenu` now reuses the cached menu box, so no wait is needed
      // (and the menu no longer visibly jumps a frame after the drag ends).
      if (this.selectedBlocks?.length) moveMenu(this.selectedBlocks, menu, this._zoom)
    }
  }

  fireMove(blockData, evtName = 'ne-move') {
    if (!blockData) return
    // P3-2: report the queued connector moves FIRST, so a consumer never
    // receives a block-level `ne-move`/`ne-move-done` before the connector
    // positions (and therefore the lines) it refers to
    this.flushMoves()

    let { pos, id, el } = blockData
    this.fireCustom(this, evtName, { top: pos[1], left: pos[0], nid: id, domNode: el, pos })
  }
}
