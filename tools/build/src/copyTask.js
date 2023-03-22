import { copyFileSync, mkdirSync, lstatSync, readFileSync, writeFileSync } from 'fs'

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
      try {
        if (minimatch(file, exclude[i])) return false
      } catch (e) {
        console.error('pattern match failed /', exclude[i], '/ ' + e.message, e)
      }
    }
  }

  if (include?.length) {
    let ok = false
    for (let i = include.length - 1; i >= 0; i--) {
      try {
        if (minimatch(file, include[i])) {
          ok = true
          break
        }
      } catch (e) {
        console.error('pattern match failed /' + exclude[i] + '/ ' + e.message, e)
      }
    }
    return ok
  }
  return true
}

export const copyTask = (
  folder,
  to,
  { include = [], exclude = [], watch = false, filters = [], delay = 50 } = {},
) => {
  mkdirSync(to, { recursive: true })
  const createdDir = {}

  const copyFile = rel => {
    let toPath = to + '/' + rel
    let fPath = folder + '/' + rel
    const idx = rel.lastIndexOf('/')
    if (idx !== -1) {
      const dirToMake = rel.substring(0, idx)
      if (!createdDir[dirToMake]) {
        mkdirSync(dirToMake, { recursive: true })
        createdDir[dirToMake] = true
      }
    }
    if (!lstatSync(fPath).isDirectory()) doCopy(fPath, toPath, filters, rel)
  }

  const folderNameLen = folder.length
  let matches = glob.sync(folder + '/**', { sync: true, nodir: true }).forEach(f => {
    let rel = f.substring(folderNameLen + 1)
    if (checkMatch(rel, include, exclude)) {
      copyFile(rel)
    }
  })
  if (watch) {
    watchDir(folder, (type, rel) => {
      if (checkMatch(rel, (include = []), (exclude = []))) {
        copyFile(rel)
      }
    })
  }
}

const doCopy = (inp, out, filters = [], rel) => {
  try {
    let conetentOut
    if (filters?.length) {
      let content
      filters.forEach(({ filter, include = [], exclude = [] }) => {
        if (checkMatch(rel, include, exclude)) {
          if (!content) content = readFileSync(inp).toString()
          let tmp = filter(conetentOut === undefined ? content : conetentOut)
          if (tmp !== undefined) conetentOut = tmp
        }
      })
    }

    if (conetentOut === undefined) {
      console.log('copy to', out)
      copyFileSync(inp, out)
    } else {
      console.log('copy transformed to', out)
      writeFileSync(out, conetentOut)
    }
  } catch (e) {
    console.error('problem copy from ', inp, ' to ', out, ': ', e.message, e)
  }
}
