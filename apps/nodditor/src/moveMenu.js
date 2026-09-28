import { getBlocksBounds } from './getBlocksBounds.js'

/**
 * P3-4: `getBoundingClientRect` forces a layout pass, and `moveMenu` used to
 * call it on every drag frame. The menu box is therefore measured once and
 * cached on the element (in ZOOM-INDEPENDENT, i.e. unscaled CSS pixels, so
 * zooming does not invalidate it). The cache is dropped by a `MutationObserver`
 * on the menu subtree, i.e. the menu is re-measured only when its CONTENT
 * changes (a new button, edited text, a size change coming from CSS).
 * A menu that measures 0 (not inserted yet, or hidden with `display: none`) is
 * deliberately NOT cached, so the next visible placement measures again.
 * @param {HTMLElement} menu
 * @param {number} zoom current editor zoom (the measured box is scaled by it)
 * @returns {Array<number>} `[width, height]` in unscaled CSS pixels
 */
const menuSize = (menu, zoom) => {
  let size = menu._neMenuSize
  if (size) return size
  let rect = menu.getBoundingClientRect()
  size = [rect.width / zoom, rect.height / zoom]
  if (!size[0] || !size[1]) return size
  menu._neMenuSize = size
  if (typeof MutationObserver === 'function' && !menu._neMenuObs) {
    menu._neMenuObs = new MutationObserver(() => {
      menu._neMenuSize = null
    })
    menu._neMenuObs.observe(menu, { childList: true, subtree: true, characterData: true })
  }
  return size
}

/**
 * Position the selection menu centered over the WHOLE selection group
 * (single block: same place as before — multi-select support for P2).
 *
 * The coordinates are published as CSS variables; `.ne-menu` in static/nodditor.css turns them into
 * `left`/`top`. Nothing inline is written, so a host can restyle or re-anchor the menu.
 */
export const moveMenu = (blocks, menu, zoom = 1) => {
  if (menu.moveMenu) return menu.moveMenu(blocks, menu)

  let [w, h] = menuSize(menu, zoom)
  let b = getBlocksBounds(blocks)
  let { style } = menu
  style.setProperty('--ne-menu-x', b.x + b.w / 2 - w / 2 + 'px')
  style.setProperty('--ne-menu-y', b.y - h + 'px')
}
