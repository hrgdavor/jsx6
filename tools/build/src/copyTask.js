import { copyFileSync, mkdirSync } from 'fs'

import glob from 'glob'
import minimatch from 'minimatch'

export const filterMatches = (files, patterns, include) => {
  if (patterns?.length) {
    return files.filter(f => {
      let ok = !include
      patterns.forEach(m => {
        if (minimatch(f, m)) ok = include
      })
      return ok
    })
  }
  return files
}

export const copyTask = (folder, to, { include = [], exclude = [] } = {}) => {
  mkdirSync(folder, { recursive: true })
  const createdDir = {}
  const folderNameLen = folder.length
  let matches = glob
    .sync(folder + '/**', { sync: true, nodir: true })
    .map(f => f.substring(folderNameLen + 1))
  matches = filterMatches(matches, include, true)
  matches = filterMatches(matches, exclude, false)

  matches.forEach(f => {
    const idx = f.lastIndexOf('/')
    if (idx !== -1) {
      const dirToMake = to + '/' + f.substring(0, idx)
      if (!createdDir[dirToMake]) {
        mkdirSync(dirToMake, { recursive: true })
        createdDir[dirToMake] = true
      }
    }
    copyFileSync(folder + '/' + f, to + '/' + f)
  })
}
