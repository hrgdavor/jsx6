export function trimTitle(title) {
  if (title && title[0] === '#') {
    const idx = title.indexOf(' ')
    title = title.substring(idx + 1)
  }
  return title
}
