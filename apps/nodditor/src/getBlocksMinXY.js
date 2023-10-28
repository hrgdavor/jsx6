/**
 * Calculate min position from all blocks.
 * @param {Array<import("./NodeEditor.jsx").BlockData} blocks
 * @returns {Array<Number>} [minx, miny]
 */
export function getBlocksMinXY(blocks) {
  let minx
  let miny = (minx = Number.MAX_SAFE_INTEGER)
  blocks.forEach(blockData => {
    let [x, y] = blockData.pos
    minx = Math.min(minx, x)
    miny = Math.min(miny, y)
  })
  return [minx, miny]
}
