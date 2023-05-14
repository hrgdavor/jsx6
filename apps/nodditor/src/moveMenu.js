export const moveMenu = (blocks, menu) => {
  if (menu.moveMenu) return menu.moveMenu(blocks, menu)

  let rect = menu.getBoundingClientRect()
  let { pos, size } = blocks[0]
  let { style } = menu
  let x = pos[0] - (rect.width - size[0]) / 2
  let y = pos[1] - rect.height
  style.left = x + 'px'
  style.top = y + 'px'
}
