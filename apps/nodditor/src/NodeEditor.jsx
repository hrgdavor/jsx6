import {
  $Or,
  $S,
  Jsx6,
  addClass,
  classIf,
  debounceMicro,
  findParent,
  fireCustom,
  getAttr,
  hSvg,
  insert,
  isArray,
  isNode,
  listen,
  observe,
  remove,
  setAttribute,
  setSelected,
  toDomNode,
} from '@jsx6/jsx6'

import { ConnectLine } from './ConnectLine.js'
import { LineInteraction } from './LineInteraction.js'
import { findConnector, recalcPos, updatePos } from './connectorUtil.js'
import { finalize, listenUntil } from './listenUntil.js'
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

  /**
   * @param {ConnectorData} con
   */
  newConnector(con) {
    this.lineinteraciton.newConnector(con)
  }

  initAttr(attr) {
    addClass(attr, 'NodeEditor')
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
          neBlock.size = [boxSize.inlineSize, boxSize.blockSize]
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
    return attr
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
    this.initConnectorTracking(blockData)
    return blockData
  }

  initConnectorTracking(id) {
    let blockData = this.getBlockData(id)
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
    return this.blockMap.get(blockId).connectorMap.get(cid)
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
    console.log('idx', idx, toDomNode(line.el))
    if (idx != -1) {
      this.lines.splice(idx, 1)
      remove(line.el)
      finalize(line)
    }
  }

  removeBlock(block) {
    let idx = this.blocks.indexOf(block)
    console.log('idx', idx, toDomNode(block.el))
    if (idx != -1) {
      this.blocks.splice(idx, 1)
      // todo remove lines connected to it
      let lines = this.lines.filter(line => line.p1.con?.root.id == block.id || line.p2.con?.root.id == block.id)
      lines.forEach(l => this.removeLine(l))
      remove(block.el)
      finalize(block)
    }
  }

  setPos(nid, pos) {
    let blockData = this.getBlockData(nid)
    if (blockData) {
      blockData.pos = pos
      blockData.connectorMap.forEach(con => {
        updatePos(con)
        this.fireCustom(con.el, 'ne-move', { ...con })
      })
      blockData.el.style.transform = `translate(${pos[0]}px, ${pos[1]}px)`
    }
  }

  tpl() {
    const { $s, el } = this
    // create a signal tht tells if editor has focus to work with blocks or lines
    // used to decide if delete will try to delete blocks or lines and for other needs
    this.$focusOrSelecting = $Or($s.isDown, $s.hasFocus)
    observe(this.$focusOrSelecting, f => classIf(this.el, 'focused', f))
    let lx = 0
    let ly = 0
    let domNode
    let nid
    let blockData

    el.addEventListener('dragstart', e => {
      if (blockData) e.preventDefault()
    })
    el.addEventListener('pointerdown', e => {
      let hasDrag
      let hasBlock
      domNode = findParent(e.target, p => {
        if (!p.hasAttribute) return false
        if (p.hasAttribute('ne-drag')) hasDrag = true
        if (p.hasAttribute('ne-nodrag')) hasBlock = true
        return p.hasAttribute('nid')
      })
      if (!domNode || !hasDrag || hasBlock) return

      nid = getAttr(domNode, 'nid')
      blockData = this.getBlockData(nid)
      lx = e.clientX
      ly = e.clientY
      domNode.startLeft = blockData.pos[0]
      domNode.startTop = blockData.pos[1]
      $s.isDown = true
      //  this.focus()
    })

    el.addEventListener('pointerup', e => {
      if (!$s.isDown()) {
        this.deselect()
        return
      }
      $s.isDown = false
      if ($s.isMoving()) el.releasePointerCapture(e.pointerId)
      $s.isMoving = false
      let { pos } = blockData
      this.fireCustom(el, 'ne-move-done', { top: pos[1], left: pos[1], nid, domNode, pos })
      if ($s.isMoving()) {
        e.preventDefault()
      } else {
        this.selectBlocks([blockData])
      }
      blockData = domNode = nid = undefined
      //this.focus()
    })

    let _timer
    el.addEventListener('pointermove', e => {
      if (!$s.isDown()) return

      if (!$s.isMoving()) {
        // pointer capture inside pointerdown caused clicking to not work
        // it is better to capture pointer only on pointer down + first movement
        el.setPointerCapture(e.pointerId)
        $s.isMoving = true
        this.selectBlocks([blockData])
        window.getSelection().removeAllRanges()
        this.focus()
      }
      const top = domNode.startTop - ly + e.clientY
      const left = domNode.startLeft - lx + e.clientX
      if (_timer) cancelAnimationFrame(_timer)
      _timer = requestAnimationFrame(() => {
        if (!blockData) return
        this.setPos(blockData, [left, top])
        this.fireCustom(el, 'ne-move', { top, left, nid, domNode, pos: blockData.pos })
      })
    })
    const keypress = e => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.$focusOrSelecting()) {
        if (this.selectedLine) {
          this.removeLine(this.selectedLine)
        } else if (this.selectBlocks.length) {
          ;[...this.selectedBlocks].forEach(block => {
            this.removeBlock(block)
          })
          this.selectBlocks([])
        }
        e.preventDefault()
      }
    }
    listen(this.el, 'keydown', keypress)
    this.el.onfocus = e => ($s.hasFocus = true)
    this.el.onblur = e => ($s.hasFocus = false)
    return [
      (this.svgLayer = hSvg('svg', {
        style: 'position:absolute;pointer-events: none; width: 100%; height: 100%;',
      })),
    ]
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

  selectBlocks(blocks) {
    if (blocks.length) this.selectConnector(null)
    this.selectedBlocks = blocks
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
    fireCustom(this.el, name, detail)
  }
}
