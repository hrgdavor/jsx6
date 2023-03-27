import { copyFileSync, mkdirSync, lstatSync, readFileSync, writeFileSync } from 'fs'
import glob from 'glob'

import { calcRecursive } from './calcRecursive.js'
import { checkMatch } from './checkMatch.js'
import { createParentFolder } from './createParentFolder.js'
import { watchDir } from './watchDir.js'

export function copyTask(
  srcDir,
  to,
  { include = [], exclude = [], filters = [], watch, recursive, delay } = {},
) {
  // if recursive is not specified, calculate if it is needed, by inspecting include rules
  if (recursive === undefined) recursive = calcRecursive(include)

  mkdirSync(to, { recursive: true })

  const folderNameLen = srcDir.length
  glob.sync(srcDir + (recursive ? '/**' : '/*'), { sync: true, nodir: true }).forEach(f => {
    copyIfMatch(f.substring(folderNameLen + 1))
  })

  if (watch) {
    watchDir(srcDir, (type, rel) => copyIfMatch(rel), { recursive, delay })
  }

  // function used for initial copy and if needed for watch
  function copyIfMatch(relativePath) {
    if (checkMatch(relativePath, include, exclude)) {
      copyFileWithFilters(srcDir, to, relativePath, filters)
    }
  }
}

export function copyFileWithFilters(src, to, relativePath, filters) {
  let srcPath = src + '/' + relativePath
  if (lstatSync(srcPath).isDirectory()) return

  let toPath = to + '/' + relativePath
  createParentFolder(toPath)

  try {
    let conetentOut
    if (filters?.length) {
      let content
      filters.forEach(({ filter, binary = false, include = [], exclude = [] }) => {
        if (checkMatch(relativePath, include, exclude)) {
          if (!content) {
            content = readFileSync(srcPath)
            if (!binary) content = content.toString()
          }
          let tmp = filter(conetentOut === undefined ? content : conetentOut)
          if (tmp !== undefined) conetentOut = tmp
        }
      })
    }

    if (conetentOut === undefined) {
      console.log('copy to', toPath)
      copyFileSync(srcPath, toPath)
    } else {
      console.log('copy transformed to', toPath)
      writeFileSync(toPath, conetentOut)
    }
  } catch (e) {
    console.error('problem copying from ', srcPath, ' to ', toPath, ': ', e.message, e)
  }
}
