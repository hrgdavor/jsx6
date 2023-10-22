import {
  Jsx6,
  addClass,
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

import { ConnectLine } from './ConnectLine.js'
import { LineInteraction } from './LineInteraction.js'
import { findConnector, recalcPos, updatePos } from './connectorUtil.js'
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
export class NodeEditor extends Jsx6 {
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
   *
   * @param {any} block
   * @param {string} id
   * @param {Object} [param2]
   * @returns {BlockData}
   */
  add(block, id, { pos = [0, 0], type = '' } = {}) {
    setAttribute(block, 'nid', id)
    let rootNode = /** @type {HTMLBlock}*/ (toDomNode(block))
    block.setNodeEditor?.(this)
    // @ts-ignore
    rootNode.nodeEditor = this
    insert(this, rootNode)
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
    this.blocks.push(blockData)
    this.blockMap.set(id, blockData)
    this.nodeMap.set(blockData.el, blockData)
    this.setPos(blockData, pos)
    this.recheckConnectors(blockData)
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
      this.lines.splice(idx, 1)
      remove(line.el)
      finalize(line)
    }
  }

  removeBlock(block) {
    let idx = this.blocks.indexOf(block)
    if (idx != -1) {
      this.blocks.splice(idx, 1)
      // todo remove lines connected to it
      let lines = this.lines.filter(line => line.p1.con?.root.id == block.id || line.p2.con?.root.id == block.id)
      lines.forEach(l => this.removeLine(l))
      remove(block.el)
      finalize(block)
    }
  }

  resetView(padx = 30, pady = 30) {
    let minx
    let miny = (minx = Number.MAX_SAFE_INTEGER)
    this.blocks.forEach(blockData => {
      let [x, y] = blockData.pos
      minx = Math.min(minx, x)
      miny = Math.min(miny, y)
    })
    this.moveAll(-minx + padx, -miny + padx)
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

  tpl({ menu = null, ...attr } = {}) {
    // @ts-ignore
    addClass(attr, 'NodeEditor')
    this.menuGenerator = menu
    // @ts-ignore
    attr.tabindex = '0'
    this.lineinteraciton = new LineInteraction(this)
    const handler = arr => {
      /** @type {Set<BlockData>} */
      let blocksChanged = new Set()
      let changeTs = Date.now()
      arr.forEach(e => {
        let { target, contentRect, borderBoxSize } = e
        let boxSize = borderBoxSize[0]
        let size = [boxSize.inlineSize, boxSize.blockSize]

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

    this.svgLayer = hSvg('svg', { style: 'position:absolute;pointer-events: none; width: 100%; height: 100%;' })
    let el = <div {...attr}>{this.svgLayer}</div>
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

    el.addEventListener('dragstart', e => {
      if (blockData) e.preventDefault()
    })
    el.addEventListener('pointerdown', e => {
      ignore = false
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
      //      if (!domNode || !hasDrag || hasBlock || insideMenu) return

      if (domNode) {
        nid = getAttr(domNode, 'nid')
        blockData = this.getBlockData(nid)
        domNode.startLeft = blockData.pos[0]
        domNode.startTop = blockData.pos[1]
      }
      lx = e.clientX
      ly = e.clientY
      $s.isDown = true
    })

    el.addEventListener('pointerup', e => {
      if (ignore) return
      if (!$s.isDown()) {
        this.deselect()
        return
      }
      $s.isDown = false
      if ($s.isMoving()) el.releasePointerCapture(e.pointerId)
      $s.isMoving = false
      this.fireMoveDone(blockData)

      if ($s.isMoving()) {
        e.preventDefault()
      } else {
        if (blockData) this.selectBlocks([blockData])
      }
      blockData = domNode = nid = undefined
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
          this.selectBlocks([blockData])
        } else {
          let menu = this.currentMenu
          if (menu) menu.style.display = 'none'
        }
        window.getSelection().removeAllRanges()
        this.focus()
      }
      if (blockData) {
        const top = domNode.startTop - ly + e.clientY
        const left = domNode.startLeft - lx + e.clientX
        if (_timer) cancelAnimationFrame(_timer)
        _timer = requestAnimationFrame(() => {
          if (!blockData) return
          this.setPos(blockData, [left, top])
          let menu = this.currentMenu
          if (menu) moveMenu([blockData], menu)
          this.fireMove(blockData)
        })
      } else {
        this.moveAll(-lx + e.clientX, -ly + e.clientY)
        lx = e.clientX
        ly = e.clientY
      }
    })
    const keypress = e => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.$focusOrSelecting()) {
        if (this.selectedLine) {
          this.removeLine(this.selectedLine)
        } else if (this.selectBlocks.length) {
          this.deleteSelectedBlocks()
        }
        e.preventDefault()
      }
    }
    listen(el, 'keydown', keypress)
    el.onfocus = e => ($s.hasFocus = true)
    el.onblur = e => ($s.hasFocus = false)
    return el
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
    blocks.forEach(block => {
      this.removeBlock(block)
    })
  }
  /**
   *
   * @param {string|Array<string>} c1
   * @param {string|Array<string>} c2
   * @returns {ConnectLine}
   */
  addConnectorFromTo(c1, c2) {
    let path = new ConnectLine()
    path.setPoint1(this.getConnector(c1), false)
    path.setPoint2(this.getConnector(c2))
    return this.addConnector(path)
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
          insert(this, menu)
        }
        moveMenu(blocks, menu)
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

  focus() {
    // @ts-ignore
    this.el.focus()
  }

  /**
   *
   * @param {Element} el
   * @param {string} name
   * @param {*} [detail]
   */
  fireCustom(el, name, detail = {}) {
    fireCustom(el, name, detail)
    // @ts-ignore
    fireCustom(this.el, name, detail)
  }

  fireMoveDone(blockData) {
    this.fireMove(blockData, 'ne-move-done')
    let menu = this.currentMenu
    if (menu) {
      menu.style.display = ''
      setTimeout(() => {
        moveMenu(this.selectedBlocks, menu)
      })
    }
  }

  fireMove(blockData, evtName = 'ne-move') {
    if (!blockData) return

    let { pos, id, el } = blockData
    this.fireCustom(this.el, evtName, { top: pos[1], left: pos[1], nid: id, domNode: el, pos })
  }
}
