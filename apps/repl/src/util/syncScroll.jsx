export function syncScroll(ed1, ed2) {
  ed1.onDidScrollChange(e => ed2.setScrollTop(e.scrollTop))
  ed2.onDidScrollChange(e => ed1.setScrollTop(e.scrollTop))
}
