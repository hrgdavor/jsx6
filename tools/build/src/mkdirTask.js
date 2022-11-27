import { mkdirSync } from 'fs'

export const mkdirTask = folder => {
  mkdirSync(folder, { recursive: true })
}
