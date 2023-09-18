import { requireFunc, runFunc } from './core.js'

const dirty = new Set()
let isRunning = false
let batchFunc = func => func()

if (typeof document !== 'undefined') {
  batchFunc = window.requestAnimationFrame
}

/** Set runner other than the default requestAnimationFrame
 *
 * @param {Function} func
 */
export function setBatchFunction(func) {
  batchFunc = func
}

/** Schedule to run batch on the next animation frame (default runner is requestAnimationFrame)
 *
 * @param {Function} callback
 */
export function reqBatch(callback) {
  batchFunc(callback)
}

/** Add callback to the next batch, or run now if `isRunning==true` (the batch is running alreaday)
 *
 * @param {Function} callback to add
 * @returns {void}
 */
export function runInBatch(callback) {
  if (callback instanceof Array) {
    callback.forEach(runInBatch)
    return
  }
  requireFunc(callback)

  if (isRunning) {
    callback()
  } else {
    dirty.add(callback)
    if (dirty.size === 1) reqBatch(runDirty)
  }
}

/** Run all of the callback that need to execute
 */
export function runDirty() {
  isRunning = true
  try {
    dirty.forEach(f => runFunc(f))
    dirty.clear()
  } finally {
    isRunning = false
  }
}
