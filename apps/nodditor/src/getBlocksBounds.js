/**
 * @typedef BlockData
 * @property {number} x
 * @property {number} y
 * @property {number} maxx
 * @property {number} maxy
 * @property {number} w
 * @property {number} h
 *
 */

/**
 * Calculate bounding box of all blocks.
 * @param {Array<import("./NodeEditor.jsx").BlockData} blocks
 * @returns {BlockData}
 */
export function getBlocksMinXY(blocks) {
  if (!blocks?.length) return { x: 0, y: 0, maxx: 0, maxy: 0, w: 0, h: 0 }

  let minx
  let miny = (minx = Number.MAX_SAFE_INTEGER)
  let maxx
  let maxy = (maxx = Number.MIN_SAFE_INTEGER)
  blocks.forEach(blockData => {
    let [x, y] = blockData.pos
    let [w, h] = blockData.size
    minx = Math.min(minx, x)
    miny = Math.min(miny, y)
    maxx = Math.max(maxx, x + w)
    maxy = Math.max(maxy, y + h)
  })

  return { x: minx, y: miny, maxx, maxy, w: minx - maxx, h: miny - maxy }
}
