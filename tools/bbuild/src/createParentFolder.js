import { mkdirSync } from 'fs'

const createdDir = {}

export function createParentFolder(path) {
  const idx = path.lastIndexOf('/')
  if (idx !== -1) {
    const dirToMake = path.substring(0, idx)

    if (!createdDir[dirToMake]) {
      mkdirSync(dirToMake, { recursive: true })
      createdDir[dirToMake] = true
    }
  }
}
