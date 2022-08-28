import { trimTitle } from './trimTitle'

export function splitChapters(mdParsed) {
  const out = []
  let current
  let currentTop
  mdParsed.sections?.forEach((section, i) => {
    if (section.level && section.level < 3) {
      current = {
        title: trimTitle(section.title),
        path: section.info?.path || i + '',
        info: section.info,
        level: section.level,
        sections: [section],
      }
      if (current.level > 1 && currentTop) current.parentTitle = currentTop.title
      if (current.level == 1) currentTop = current
      out.push(current)
    } else if (current) {
      current.sections.push(section)
    } else {
      if (section.title) console.warn('skipping section without parent ', section)
    }
  })
  return out
}
