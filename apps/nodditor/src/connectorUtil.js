import { getAttr, setAttribute } from '@jsx6/jsx6'

import { observeShowHide } from '@jsx6/dom-observer'

import { calcPos } from './calcPos.js'
import { pairSum } from './pairUtils.js'

/**
 * Discover the connectors of a block (elements carrying an `ncid` attribute)
 * and keep `blockData.connectorMap` up to date.
 *
 * P3-1 (memoized discovery): the subtree walk — plus `getComputedStyle` and the
 * offset-chain measurement for every NEW connector — is only worth paying when
 * the block DOM changed structurally, so the scan is skipped and the existing
 * `connectorMap`/`resizeSet` are reused unless `blockData.structDirty` is set.
 * NodeEditor marks a block dirty from ONE canvas-wide `MutationObserver`
 * (`ensureStructObserver`, the real "structurally changed" signal; P1-3 shipped
 * removal tracking only), and `add`
 * starts a block out dirty so its connectors are discovered once. Pass `force`
 * to always walk.
 *
 * @param {import('./NodeEditor.jsx').BlockData} blockData
 * @param {boolean} [force] scan even when nothing changed structurally
 * @returns {{resizeSet: Set<Element>, cached: boolean}} `resizeSet` is the
 *          (re)used set of elements that must be watched for resize;
 *          `cached` tells that no walk happened
 */
export function findConnector(blockData, force) {
  let { connectorMap, el: rootNode } = blockData
  if (!force && !blockData.structDirty && blockData.resizeSet) {
    // structurally unchanged since the last scan: reuse what we found
    return { resizeSet: blockData.resizeSet, cached: true }
  }
  let resizeSet = new Set()
  resizeSet.add(rootNode)

  visit(rootNode)
  blockData.structDirty = false
  return { resizeSet, cached: false }

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
        let relPos = calcPos(el, blockData.el)
        connectData = {
          id: ncId,
          dir: getAttr(el, 'ne-connect'),
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
        // Watch the connector element: when it is REMOVED from the document the IntersectionObserver
        // delivers one final entry with intersectionRatio 0 and the editor cleans the connector up
        // (NodeEditor.removeConnector). The root is the block element, so dragging the block outside
        // the viewport cannot trigger a false cleanup.
        //
        // `intersectionRatio === 0` alone is NOT "removed": a collapsed list row, `hidden`, a
        // `display:none` section or a zero-height box inside the block reports 0 while still being in
        // the document — and the connector it holds is still perfectly connectable (a line endpoint
        // does not need to be visible). Treating those as removals deleted live connectors from the
        // map with no way back, so the only cleanup now is a genuinely detached element.
        el.removeObserve = observeShowHide(
          el,
          entry => {
            if (!entry.intersectionRatio && !el.isConnected) blockData.editor.removeConnector(connectData)
          },
          { root: rootNode },
        )
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
 * @param {import('./NodeEditor.jsx').BlockData} blockData
 */
export function addResize(resizeSet, el, rootNode, blockData) {
  resizeSet.add(el)
  el = el.parentElement
  el.neBlock = blockData
  if (el != rootNode) addResize(resizeSet, el, rootNode, blockData)
}

/**
 * @param {import('./NodeEditor.jsx').ConnectorData} connectData
 */
export function recalcPos(connectData) {
  connectData.relPos = calcPos(connectData.el, connectData.root.el)
  updatePos(connectData)
}

/**
 * @param {import('./NodeEditor.jsx').ConnectorData} connectData
 */
export function updatePos(connectData) {
  connectData.pos = pairSum(connectData.relPos, connectData.root.pos)
}
