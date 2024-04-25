export function calcRecursive(include) {
  let recursive = !include?.length
  include?.forEach(inc => {
    if (inc.includes('**')) recursive = true
  })
  return recursive
}
