// @ts-check

export function debounceMicro(func) {
  let promise
  return function (...args) {
    if (!promise) {
      promise = true
      Promise.resolve().then(() => {
        promise = false
        func.apply(this, args)
      })
    }
  }
}

export function debounce(func, timeout = 300) {
  let timer
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => {
      func.apply(this, args)
    }, timeout)
  }
}

export function debounceAnim(func) {
  let timer
  return function (...args) {
    cancelAnimationFrame(timer)
    timer = requestAnimationFrame(() => {
      func.apply(this, args)
    })
  }
}

/**
 * Run the first one immediately, but block subsequent until cooldown is reached.
 * Unlike debunce that will only execute the last one from a burst.
 *
 * This is useful for user interaction where you want to allow immediate action, but do
 * not want to allow spamming, or for example to prevent doubleclick to trigger 2 rpc calls.
 *
 * @param {*} func
 * @param {*} timeout
 * @returns
 */
export function debounceLeading(func, timeout = 300) {
  let timer
  return function (...args) {
    clearTimeout(timer)
    if (!timer) {
      func.apply(this, args)
    }
    timer = setTimeout(() => {
      timer = undefined
    }, timeout)
  }
}
