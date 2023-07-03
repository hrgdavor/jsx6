const { min, sqrt } = Math

/** Generate bezier curve that connects two points (left1,top1)--(left2,top2)
 *
 * @param {number} strength of the curve at connection point
 * @param {Array<number>} p1
 * @param {Array<number>} box1pos
 * @param {Array<number>} box1
 * @param {String} dir1
 * @param {Array<number>} p2
 * @param {Array<number>} box2pos
 * @param {Array<number>} box2
 * @param {String} dir2
 * @returns {String} path definition for the bezier
 */
export const makeLineConnector = (strength, p1, box1, box1pos, dir1, p2, box2, box2pos, dir2) => {
  let [left1, top1] = p1
  let [left2, top2] = p2
  strength = min(strength, sqrt((left1 - left2) ** 2 + (top1 - top2) ** 2) / 2)
  return `M${left1} ${top1} C${left1 + strength} ${top1} ${left2 - strength} ${top2} ${left2} ${top2}`
}
