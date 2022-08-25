import { toDomNode } from './toDomNode'

const listenMap = new WeakMap()

export function observeResize(el, callback) {
  el = toDomNode(el)
  let arr = listenMap.get(el)

  if (!arr) {
    listenMap.set(el, (arr = []))
  }

  if (!arr.length) observer.observe(el)
  arr.push(callback)

  // function that removes the listener
  return function () {
    const arr = listenMap.get(el)
    if (arr) {
      const idx = arr.findIndex(f => f === callback)
      if (idx != -1) {
        arr.splice(idx, 1)
      }
    }
    if (!arr?.length) observer.unobserve(el)
  }
}

const observer = (observeResize.observer = new ResizeObserver(entries => {
  entries.forEach(entry => {
    listenMap.get(entry.target)?.forEach(fn => {
      try {
        fn(entry)
      } catch (e) {
        console.error('problem calling ResizeObserver listener: ' + e.message, fn, e)
      }
    })
  })
}))
