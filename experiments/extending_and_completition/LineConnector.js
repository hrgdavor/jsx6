import { hSvg } from '@jsx6/jsx6'

import { extendObjWithClass } from './extendObjWithClass'

/* Code here is organized to experiment on how to get precise autocompletition in vscode (hints, and code nav)
 *
 * SVGPathElement can not be extended so we trade a bit of brevity to get proper autocompletition and code navigation
 * in vscode.
 * Class is declared with methods, and the created svg path is augmented with those methods using extendObjWithClass.
 * This way vscode sees the method and can provide hints for parameters and return value
 */

/**
 * @typedef {Object} LineConnectorParam
 * @property {number} strength
 */

/**
 * @param {LineConnectorParam}
 * @returns {LineConnectorType}
 */
export function LineConnector({ strength, ...attr }) {
  const out = hSvg('path', attr)
  extendObjWithClass(out, LineConnectorType)
  out.strength = strength
  return out
}

/**
 * Placeholder class for the needed extra methods. It is never instantiated, but is used to copy the methods
 * to the svg path elements created by LineConnector function.
 */
class LineConnectorType {
  setPoints(left1, top1, left2, top2) {
    const { strength } = this
    const d = `M${left1} ${top1} C${left1 + strength} ${top1} ${left2 - strength} ${top2} ${left2} ${top2}`
    this.setAttribute('d', d)
  }
}
