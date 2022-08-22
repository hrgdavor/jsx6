import MarkDownIt from 'markdown-it'
import { isPromise } from '../async/isPromise'

export function markdown(code, colorize) {
  const promises = []
  const keys = []
  let seq = 1
  const md = new MarkDownIt({
    highlight: function (str, lang) {
      const colorized = colorize(str, lang)
      if (isPromise(colorized)) {
        const key = `{{colorize.${seq++}.${Math.random()}}}`
        promises.push(colorized)
        keys.push(key)
        return key
      } else {
        return colorized
      }
    },
  })

  let rendered = md.render(code)
  if (keys.length) {
    return new Promise(resolve => {
      Promise.all(promises).then(val => {
        const codeMap = {}
        for (let i = 0; i < keys.length; i++) {
          codeMap[keys[i]] = val[i]
        }
        var reg = /\{\{colorize[^}]+\}\}/g
        rendered = rendered.replaceAll(reg, key => codeMap[key] || key)
        resolve(rendered)
      })
    })
  } else {
    return Promise.resolve(rendered)
  }
}

export function extractProvided(mdParsed) {
  const out = {}
  if (mdParsed.sections) {
    mdParsed.sections.forEach(section => {
      if (section.lines) {
        section.lines = section.lines.filter(line => {
          if (line.code !== undefined) {
            if (line.info?.provides) {
              out[line.info.provides] = line
              return false
            }
          }
          return true
        })
      }
    })
  }
  return out
}
