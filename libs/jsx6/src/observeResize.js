import { toDomNode } from './toDomNode'

export function observeResize(el, callback) {
  el = toDomNode(el)
  let arr = el[symbol]
  if (!arr) arr = el[symbol] = []
  if (!arr.length) observer.observe(el)
  arr.push(callback)

  // function that removes the listener
  return function () {
    const arr = el[symbol]
    if (arr) {
      const idx = arr.findIndex(f => f === callback)
      if (idx != -1) {
        arr.splice(idx, 1)
      }
    }
    if (!arr?.length) observer.unobserve(el)
  }
}

const symbol = (observeResize.symbol = Symbol('observeResize'))

const observer = (observeResize.observer = new ResizeObserver(entries => {
  entries.forEach(entry => {
    entry.target[symbol]?.forEach(fn => {
      try {
        fn(entry)
      } catch (e) {
        console.error('problem calling ResizeObserver listener: ' + e.message, fn, e)
      }
    })
  })
}))
