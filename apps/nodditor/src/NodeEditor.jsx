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
   *
   * @param {any} block
   * @param {string} id
   * @param {Object} [param2]
   * @returns {BlockData}
   */
  add(block, id, { pos = [0, 0], type = '' } = {}) {
    if (this.blockMap.has(id)) throw new Error(`NodeEditor: block id "${id}" is already in use`)
    setAttribute(block, 'nid', id)
    let rootNode = /** @type {HTMLBlock}*/ (toDomNode(block))
    block.setNodeEditor?.(this)
    // @ts-ignore
    rootNode.nodeEditor = this
    insert(this.contentArea, rootNode)
    rootNode.style.top = '0'
    rootNode.style.left = '0'
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
    this.blocks.push(blockData)
    this.blockMap.set(id, blockData)
    this.nodeMap.set(blockData.el, blockData)
    this.setPos(blockData, pos)
    this.recheckConnectors(blockData)
    this.historyRecord('add')
    return blockData
  }

  recheckConnectors(blockData) {
    let { resizeSet } = findConnector(blockData)
    updateObserver(resizeSet, blockData.resizeSet, this.observer)
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
    // capture the connected lines BEFORE firing `ne-remove`: the listener
    // clears the line endpoints (p.con -> null), so a filter afterwards would
    // match nothing
    let lines = this.lines.filter(line => line.p1.con?.idFull == con.idFull || line.p2.con?.idFull == con.idFull)
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
      block.connectorMap.forEach(con => this.removeConnector(con))
      remove(block.el)
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
      this.fireCustom(con.el, 'ne-move', { ...con })
    })
    blockData.el.style.transform = `translate(${pos[0]}px, ${pos[1]}px)`
  }

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
    // @ts-ignore
    this.lineinteraciton = new LineInteraction(this)
    const handler = arr => {
      /** @type {Set<BlockData>} */
      let blocksChanged = new Set()
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
            blocksChanged.add(ncData.root)
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
      blocksChanged.forEach(block => {
        this.recheckConnectors(block)
        block.connectorMap.forEach(con => {
          let tmp = con.pos
          recalcPos(con)
          // changed position or size
          if (pairChanged(tmp, con.pos) || con.changed == changeTs) {
            this.fireCustom(con.el, 'ne-move', { ...con })
          }
        })
      })
    }
    this.observer = new ResizeObserver(handler)
    this.observer.observe(this)
    this.svgLayer = hSvg('svg', {
      style: 'position:absolute;pointer-events: none; width: 100%; height: 100%;',
    })
    this.contentArea = (
      <div style="position:absolute;top:0;left:0;width:100%; height:100%; transform-origin: top left;">
        {this.svgLayer}
      </div>
    )
    this._zoom = 1
    // zoom indicator + controls, in the (unscaled) editor corner — see changeZoom*/zoomTo
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
    this.zoomLabel = this.zoomUI.children[1]
    // aria-live region announcing selection changes (screen-reader status)
    this.statusEl = <div class="ne-sr-status" role="status" aria-live="polite"></div>
    insert(this, this.zoomUI)
    insert(this, this.statusEl)
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
      let st = marqueeEl.style
      st.left = Math.min(marqueeStart[0], marqueeCur[0]) + 'px'
      st.top = Math.min(marqueeStart[1], marqueeCur[1]) + 'px'
      st.width = Math.abs(marqueeCur[0] - marqueeStart[0]) + 'px'
      st.height = Math.abs(marqueeCur[1] - marqueeStart[1]) + 'px'
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

    let _timer
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
          if (menu) menu.style.display = 'none'
          if (downButton === 0 && !e.altKey && !e.ctrlKey && !e.metaKey) {
            // left drag over empty canvas: marquee select (pan with middle button or Alt+drag)
            marqueeStart = this.contentPoint(lx, ly) // lx/ly = pointerdown client pos
            marqueeCur = [...marqueeStart]
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
        let dx = nx - x0
        let dy = ny - y0
        if (_timer) cancelAnimationFrame(_timer)
        _timer = requestAnimationFrame(() => {
          if (!blockData || !dragList) return
          for (let i = 0; i < dragList.length; i++) {
            this._setPos(dragList[i], [dragStart[i][0] + dx, dragStart[i][1] + dy])
          }
          let menu = this.currentMenu
          if (menu) moveMenu(dragList, menu, this._zoom)
          this.fireMove(blockData)
        })
      } else if (marqueeEl) {
        marqueeCur = this.contentPoint(e.clientX, e.clientY)
        updateMarquee()
      } else {
        this.moveAll((-lx + e.clientX) / this._zoom, (-ly + e.clientY) / this._zoom)
        lx = e.clientX
        ly = e.clientY
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
          menu.style.display = ''
          if (!menu.parentNode) {
            menu.style.position = 'absolute'
            insert(this.contentArea, menu)
          }
          this.currentMenu = menu
          menu.afterAdd?.([])
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
    this.contentArea.style.transform = `scale(${zoom})`
    this.updateSize()
    this.updateZoomUI()
  }

  updateSize() {
    this.contentArea.style.width = this.realWidth / this._zoom + 'px'
    this.contentArea.style.height = this.realHeight / this._zoom + 'px'
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
    if (!con1 || !con2)
      throw new Error(`NodeEditor: unknown connector: "${con1?.idFull ?? c1}" / "${con2?.idFull ?? c2}"`)
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
   * clearing the editor first. `typeMap` maps a block `type` to a factory
   * that returns a FRESH block element (e.g. `{ Switch: () => <Switch/> }`)
   * — the editor does not know block components itself, so every block type
   * in `state.blocks` must have an entry in `typeMap`. Defaults to the
   * editor's own `typeMap` (set via `tpl({ typeMap })` or the property).
   * The undo/redo baseline is reset afterwards: loading is not an "edit".
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
        this.add(make(), b.id, { pos: [b.pos[0], b.pos[1]], type: b.type })
      }
      for (let [c1, c2] of state?.lines ?? []) {
        this.addConnectorFromTo(c1, c2)
      }
    } finally {
      this._loadingGraph = false
    }
    this.historyReset()
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
      let merge = kind == this._histKind && (kind == 'zoom' || kind == 'nudge') && Date.now() - this._histTs < 750
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
    this.setAriaStatus('Undo')
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
    this.setAriaStatus('Redo')
    return true
  }
  /**
   *
   * @typedef Menu
   * @property {Function} afterAdd
   *
   * @typedef {HTMLElement & Menu} MenuHtml
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
      /** @type {MenuHtml} */
      menu = this.menuGenerator?.(blocks)
      if (old && old != menu) setVisible(old, false)
      if (menu) {
        setVisible(menu, true)
        if (menu != old) {
          menu.style.position = 'absolute'
          insert(this.contentArea, menu)
        }
        moveMenu(blocks, menu, this._zoom)
        menu.afterAdd?.(blocks)
      }
    } else {
      if (old) setVisible(old, false)
    }
    this.currentMenu = menu
    this.blocks.forEach(p => {
      /** @type {Element|any} */
      let block = p.block
      let sel = blocks.includes(p)
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
    this.setAriaStatus()
  }

  selectConnector(con) {
    if (con) this.selectBlocks([])
    this.selectedLine = con
    this.lines.forEach(p => {
      p.setSelected(p == con)
    })
    this.setAriaStatus()
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
    menu.style.display = ''
    let [x, y] = this.contentPoint(e.clientX, e.clientY)
    menu.style.left = x + 'px'
    menu.style.top = y + 'px'
  }

  /**
   * Accessible name of a block (id + type + selection state).
   * @param {BlockData} blockData
   * @param {boolean} selected
   */
  setBlockLabel(blockData, selected) {
    let { id, type, el } = blockData
    el.setAttribute('aria-label', `${type || 'block'} ${id}${selected ? ' selected' : ''}`)
  }

  /**
   * Announce the current selection state in the `aria-live` status region.
   * @param {string} [msg] explicit message; when omitted it is derived from the selection
   */
  setAriaStatus(msg) {
    let el = this.statusEl
    if (!el) return
    if (!msg) {
      let sel = this.selectedBlocks || []
      if (this.selectedLine) {
        let l = this.selectedLine
        msg = `connection ${l.p1.con?.idFull ?? '?'} to ${l.p2.con?.idFull ?? '?'} selected`
      } else if (sel.length == 1) {
        msg = `block ${sel[0].id} selected`
      } else if (sel.length > 1) {
        msg = `${sel.length} blocks selected`
      } else {
        msg = 'selection cleared'
      }
    }
    el.textContent = msg
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
    this.currentMenu = null
    this.observer?.disconnect()
    this.undoStack.length = 0
    this.redoStack.length = 0
    this._histLast = null
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
      menu.style.display = ''
      setTimeout(() => {
        if (this.selectedBlocks?.length) moveMenu(this.selectedBlocks, menu, this._zoom)
      })
    }
  }

  fireMove(blockData, evtName = 'ne-move') {
    if (!blockData) return

    let { pos, id, el } = blockData
    this.fireCustom(this, evtName, { top: pos[1], left: pos[0], nid: id, domNode: el, pos })
  }
}
