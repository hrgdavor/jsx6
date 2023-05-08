import { getAttr, setAttribute } from '@jsx6/jsx6'

import { calcPos } from './calcPos.js'
import { pairSum } from './pairUtils.js'

/**
 *
 * @param {import('./_types.js').BlockData} blockData
 * @returns
 */
export function findConnector(blockData) {
  let { connectorMap, rootNode } = blockData
  let resizeSet = new Set()
  resizeSet.add(rootNode)

  visit(rootNode)
  return { resizeSet }

  /**
   * @param {HTMLElement|any} el
   */
  function visit(el) {
    let ncId = getAttr(el, 'ncid')
    if (ncId) {
      let connectData = connectorMap.get(ncId)
      if (!connectData) {
        addResize(resizeSet, el, rootNode, blockData)
        let cStyle = getComputedStyle(el)
        let relPos = calcPos(el, blockData.rootNode)
        connectData = {
          id: ncId,
          changed: 1,
          pos: [0, 0],
          idFull: blockData.id + '/' + ncId,
          el,
          relPos,
          offsetX: parseFloat(cStyle.getPropertyValue('--offset-x')) || 0,
          offsetY: parseFloat(cStyle.getPropertyValue('--offset-y')) || 0,
          root: blockData,
          editor: this,
          size: [el.offsetWidth, el.offsetHeight],
        }
        blockData.editor.newConnector(connectData)
        connectorMap.set(ncId, connectData)
        updatePos(connectData)
        el.ncId = ncId
        el.ncData = connectData
        // it is important to diable drag action for connectors
        // to allow proper interaction, so line can be made instead of moving the block
        setAttribute(el, 'ne-nodrag', true)
      }
    }
    let ch = el.firstElementChild
    while (ch) {
      visit(ch)
      ch = ch.nextElementSibling
    }
  }
}

/**
 *
 * @param {Set<HTMLElement>} resizeSet
 * @param {HTMLElement|*} el
 * @param {HTMLElement} rootNode
 * @param {import('./_types.js').BlockData} blockData
 */
export function addResize(resizeSet, el, rootNode, blockData) {
  resizeSet.add(el)
  el = el.parentElement
  el.neBlock = blockData
  if (el != rootNode) addResize(resizeSet, el, rootNode, blockData)
}

/**
 * @param {import('./_types.js').ConnectorData} connectData
 */
export function recalcPos(connectData) {
  connectData.relPos = calcPos(connectData.el, connectData.root.rootNode)
  updatePos(connectData)
}

/**
 * @param {import('./_types.js').ConnectorData} connectData
 */
export function updatePos(connectData) {
  connectData.pos = pairSum(connectData.relPos, connectData.root.pos)
}
