/** Generate bezier curve that connects two points (left1,top1)--(left2,top2)
 *
 * @param {number} strength of the curve at connection point
 * @param {number} left1
 * @param {number} top1
 * @param {number} left2
 * @param {number} top2
 * @returns {String} path definition for the bezier
 */
export const makeLineConnector = (strength, left1, top1, left2, top2) =>
  `M${left1} ${top1} C${left1 + strength} ${top1} ${left2 - strength} ${top2} ${left2} ${top2}`