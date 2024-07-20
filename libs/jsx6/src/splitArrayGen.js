/**
 * @typedef {import('./forEachProp.js').ForEachCallback} ForEachCallback
 */

/** Splits array into chunks and triggers callback for each chunk in separate animationFrame
 *
 * returns a promise so you can await untill all are executed if desired
 *
 * @param {Array} inp
 * @param {number} chunks max size of chunks
 * @param {ForEachCallback} cb callback
 * @returns
 */
async function forEachAnimFrame(inp, chunks = 5000, cb) {
  return forEachBase(inp, chunks, cb, requestAnimationFrame)
}

/** Splits array into chunks and triggers callback like forEach.
 *  for each chunk in separate setTimeout with defined delay
 *
 * returns a promise so you can await untill all are executed if desired
 *
 * @param {Array} inp
 * @param {number} chunks max size of chunks
 * @param {ForEachCallback} cb callback
 * @param {number} sleep miliseconds between chunks
 * @param {boolean} initialSleep - default false, defines if first chunk also sleeps same as others
 * @returns
 */ async function forEachSleep(inp, chunks = 5000, cb, sleep = 100, initialSleep = false) {
  return forEachBase(inp, chunks, cb, setTimeout, sleep, initialSleep)
}

function forEachBase(
  inp,
  chunks = 5000,
  cb,
  delayFunc = requestAnimationFrame,
  sleep = 0,
  initialSleep = false,
) {
  return new Promise(resolve => {
    let offset = 0
    let len = inp.length
    function doChunk() {
      const next = Math.min(offset + chunks, len)
      for (; offset < next; offset++) {
        cb(inp[offset], offset, inp)
      }

      if (offset >= len) return resolve()

      delayFunc(doChunk, sleep)
    }

    delayFunc(doChunk, initialSleep ? sleep : 0)
  })
}

/** Splits array into chunks and triggers callback for each chunk in separate animationFrame
 *
 * returns a promise so you can await untill all are executed if desired
 *
 * @param {Array} inp
 * @param {number} chunks max size of chunks
 * @param {Function} cb callback
 * @returns
 */
async function splitArrayAnimFrame(inp, chunks = 5000, cb) {
  return splitArrayBase(inp, chunks, cb, requestAnimationFrame)
}

/** Splits array into chunks and triggers callback for each chunk in separate setTimeout with defined delay
 *
 * returns a promise so you can await untill all are executed if desired
 *
 * @param {Array} inp
 * @param {number} chunks max size of chunks
 * @param {Function} cb callback
 * @param {number} sleep miliseconds between chunks
 * @param {boolean} initialSleep - default false, defines if first chunk also sleeps same as others
 * @returns
 */ async function splitArraySleep(inp, chunks = 5000, cb, sleep = 100, initialSleep = false) {
  return splitArrayBase(inp, chunks, cb, setTimeout, sleep, initialSleep)
}

function splitArrayBase(
  inp,
  chunks = 5000,
  cb,
  delayFunc = requestAnimationFrame,
  sleep = 0,
  initialSleep = false,
) {
  return new Promise(resolve => {
    let offset = 0

    function doChunk() {
      if (inp.subarray) {
        cb(inp.subarray(offset)) // subarray for TypedArray is more performant, no copy
      } else {
        cb(inp.slice(offset, offset + chunks))
      }
      offset += chunks

      if (offset > inp.length) return resolve()

      delayFunc(doChunk, sleep)
    }

    delayFunc(doChunk, initialSleep ? sleep : 0)
  })
}

/** Splits array into chunks and returns async generator that can be used with
 * `for wawit` loop.
 *
 * Each chunk is returned with a delay
 *
 * @param {Array} inp
 * @param {number} chunks max size of chunks
 * @param {number} sleep miliseconds between chunks
 * @param {boolean} initialSleep - default false, defines if first chunk also sleeps same as others
 */
async function* splitArraySleepGen(inp, chunks = 5000, sleep = 100, initialSleep = false) {
  for (let offset = 0; offset < inp.length; offset += chunks) {
    yield new Promise(resolve => {
      setTimeout(() => resolve(inp.slice(offset, offset + chunks)), !initialSleep && offset == 0 ? 0 : sleep)
    })
  }
}
