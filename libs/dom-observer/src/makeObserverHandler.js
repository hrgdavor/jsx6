/** The handler manages observing and calling the appropriate callback.
 * It implements a function that removes a callback, and does unobserve whne tehere are no more callbacks.
 */
export const makeObserverHandler = name => {
  const listenMap = new WeakMap()

  const listener = entries => {
    entries.forEach(entry => {
      listenMap.get(entry.target)?.forEach(fn => {
        try {
          if (fn) fn(entry)
        } catch (e) {
          console.error(`problem calling ${name} listener:  ${e.message}`, fn, e)
        }
      })
    })
  }

  listener.observe = (el, callback) => {
    const observer = listener.observer

    let arr = listenMap.get(el)

    if (!arr) {
      observer.observe(el)
      listenMap.set(el, (arr = []))
    }

    arr.push(callback)

    return () => {
      let arr = listenMap.get(el)
      if (arr) {
        let count = arr.length
        let countLeft = 0

        for (let i = 0; i < count; i++) {
          if (arr[i] === callback) arr[i] = undefined
          if (arr[i]) countLeft++
        }

        if (!countLeft) {
          listenMap.delete(el)
          observer.unobserve(el)
        }
      }
    }
  }

  return listener
}
