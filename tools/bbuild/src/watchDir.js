import {  watch } from 'fs'

export const watchDir = (dir, fn, { recursive = true, delay = 50 }={}) => {
  watch(dir, { recursive }, (eventType, fname) => {
    clearTimeout(fn.timer)
    fn.timer = setTimeout(() => fn(eventType, fname), delay)
  })
}