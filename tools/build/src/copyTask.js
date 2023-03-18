import { copyFileSync, mkdirSync, lstatSync } from 'fs'

import glob from 'glob'
import minimatch from 'minimatch'
import { watchDir } from './watchDir.js'

/**
 *
 * @param {string} file
 * @param {Array<string>} include
 * @param {Array<string>} exclude
 * @returns
 */
export const checkMatch = (file, include = [], exclude = []) => {
  if (exclude?.length) {
    for (let i = exclude.length - 1; i >= 0; i--) {
      if (minimatch(file, exclude[i])) return false
    }
  }

  if (include?.length) {
    let ok = false
    for (let i = include.length - 1; i >= 0; i--) {
      if (minimatch(file, include[i])) {
        ok = true
        break
      }
    }
    return ok
  }
  return true
}

export const copyTask = (folder, to, { include = [], exclude = [], watch = false, delay = 50 } = {}) => {
  mkdirSync(to, { recursive: true })
  const createdDir = {}

  const copyFile = f => {
    const idx = f.lastIndexOf('/')
    if (idx !== -1) {
      const dirToMake = to + '/' + f.substring(0, idx)
      if (!createdDir[dirToMake]) {
        mkdirSync(dirToMake, { recursive: true })
        createdDir[dirToMake] = true
      }
    }
    if (!lstatSync(folder + '/' + f).isDirectory()) copyFileSync(folder + '/' + f, to + '/' + f)
  }

  const folderNameLen = folder.length
  let matches = glob
    .sync(folder + '/**', { sync: true, nodir: true })
    .map(f => f.substring(folderNameLen + 1))
    .filter(f => checkMatch(f, include, exclude))

  matches.forEach(copyFile)
  if (watch) {
    watchDir(folder, (type, f) => {
      if (checkMatch(f, include, exclude)) copyFile(f)
    })
  }
}
