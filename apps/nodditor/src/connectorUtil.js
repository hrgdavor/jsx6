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
      // A replaced port is recognised by its PREVIOUS element no longer being connected. `isConnected`
      // is the right test here and deliberately not "is it inside the canvas": a duplicate `ncid`
      // (two live elements with the same id, both connected) must keep the FIRST one, which is what
      // `explainConnectors` reports as "duplicate ncid — another element holds it".
      let stale = connectData && connectData.el !== el && !connectData.el.isConnected
      if (connectData && stale) {
        // The port ELEMENT was replaced while its `ncid` stayed the same. Data-driven hosts do this
        // all the time: blocks are added first, their intents arrive asynchronously and the port
        // elements are rendered (or re-rendered) afterwards. The connector identity lives in
        // `connectData`, which the lines reference directly, so it has to be UPDATED IN PLACE —
        // treating the new element as "already known" left the map pointing at a detached element:
        // lines hung off a dead node, their `ne-remove` could never fire, and wiring the same pair
        // again failed with a bogus `"1/onTimeout" is already connected to "2/i1"` because
        // `lineExists` compares `idFull` strings and kept matching the line to the dead endpoint.
        // (A genuine duplicate — two elements with the same `ncid`, both connected — still keeps the
        // first one, see `explainConnectors`.)
        addResize(resizeSet, el, rootNode, blockData)
        let cStyle = getComputedStyle(el)
        connectData.el.removeObserve?.()
        connectData.el = el
        connectData.dir = getAttr(el, 'ne-connect')
        connectData.relPos = calcPos(el, blockData.el)
        connectData.offsetX = parseFloat(cStyle.getPropertyValue('--offset-x')) || 0
        connectData.offsetY = parseFloat(cStyle.getPropertyValue('--offset-y')) || 0
        connectData.size = [el.offsetWidth, el.offsetHeight]
        // re-point the cleanup observer at the element that is actually in the DOM now
        el.removeObserve = observeShowHide(
          el,
          entry => {
            if (!entry.intersectionRatio && !el.isConnected) blockData.editor.removeConnector(connectData)
          },
          { root: rootNode },
        )
        el.ncId = ncId
        el.ncData = connectData
        setAttribute(el, 'ne-nodrag', true)
        updatePos(connectData)
        // the lines' click/`ne-remove` listeners still target the replaced element, so re-attach them
        blockData.editor?.reattachLines?.(connectData)
        // report the (possibly) new position as a move so the lines redraw
        blockData.editor?.queueMove?.(connectData)
      } else if (!connectData) {
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
