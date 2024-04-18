// @ts-check

export function debounceMicro(func) {
  let promise
  return (...args) => {
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
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      func.apply(this, args)
    }, timeout)
  }
}

export function debounceAnim(func) {
  let timer
  return (...args) => {
    cancelAnimationFrame(timer)
    timer = requestAnimationFrame(() => {
      func.apply(this, args)
    })
  }
}

export function debounceLeading(func, timeout = 300) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    if (!timer) {
      func.apply(this, args)
    }
    timer = setTimeout(() => {
      timer = undefined
    }, timeout)
  }
}
