import minimatch from 'minimatch'

/**
 *
 * @param {string} file
 * @param {Array<string>} include
 * @param {Array<string>} exclude
 * @returns
 */

export const checkMatch = (file, include = [], exclude = []) => {
  if (exclude?.length) {
    for (let i = exclude.length - 1; i >= 0; i--) {
      try {
        if (minimatch(file, exclude[i])) return false
      } catch (e) {
        console.error('pattern match failed /', exclude[i], '/ ' + e.message, e)
      }
    }
  }

  if (include?.length) {
    let ok = false
    for (let i = include.length - 1; i >= 0; i--) {
      try {
        if (minimatch(file, include[i])) {
          ok = true
          break
        }
      } catch (e) {
        console.error('pattern match failed /' + exclude[i] + '/ ' + e.message, e)
      }
    }
    return ok
  }
  return true
}
