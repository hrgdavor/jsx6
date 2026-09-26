import { getBlocksBounds } from './getBlocksBounds.js'

/**
 * Position the selection menu centered over the WHOLE selection group
 * (single block: same place as before — multi-select support for P2).
 */
export const moveMenu = (blocks, menu, zoom) => {
  if (menu.moveMenu) return menu.moveMenu(blocks, menu)

  let rect = menu.getBoundingClientRect()
  let b = getBlocksBounds(blocks)
  let { style } = menu
  let x = b.x + b.w / 2 - rect.width / zoom / 2
  let y = b.y - rect.height / zoom
  style.left = x + 'px'
  style.top = y + 'px'
}
