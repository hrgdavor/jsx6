export function isPromise(p) {
  if (p !== null && typeof p === 'object' && typeof p.then === 'function' && typeof p.catch === 'function') {
    return true
  }
  return false
}
