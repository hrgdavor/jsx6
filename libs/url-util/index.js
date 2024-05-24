/**
 * Map string values returned by {URLSearchParams} to boolean.
 * /?param - empty string -> true
 * /?param=1 - "1" -> true
 * /?param=true - "true" -> true
 *
 * false otherwise
 *
 * @param {string|null} val
 * @returns {boolean} boolean
 */
export const urlBool = val => {
  if (val === '' || val === '1' || val === 'true') return true
  return false
}

const main = new URL(location.toString())
const sp = main.searchParams

/**
 * string with current value of main url
 * @returns {string}
 */
export const urlStr = () => main.toString()

/** Get value of a parameter, and if not present use the provided default and return it.
 *
 * @param {string} name
 * @param {string} def - default value
 * @param {URLSearchParams} searchParams
 * @returns {string}
 */
export function urlInit(name, def, searchParams = sp) {
  if (searchParams.has(name)) {
    return searchParams.get(name)
  } else {
    searchParams.set(name, def)
    return def
  }
}

/** set query param value
 * @param {string} name
 * @param {string} value
 * @param {URLSearchParams} searchParams
 * @returns {void}
 */
export function urlSet(name, value, searchParams = sp) {
  if (!name) return
  if (value === undefined || value === null) {
    searchParams.delete(name)
  } else {
    searchParams.set(name, value)
  }
}

/** get query param value
 *
 * @param {string} name
 * @param {URLSearchParams} searchParams
 * @returns {string}
 */
export const urlGet = (name, searchParams = sp) => searchParams.get(name)

/** Boolean variant. Get value of a parameter, and if not present use the provided default and return it.
 *
 * @param {string} name
 * @param {string} def - default value
 * @param {URLSearchParams} searchParams
 * @returns {boolean}
 */
export const urlInitBool = (name, def, searchParams = sp) => urlBool(urlInit(name, def, searchParams))

/** Boolean variant. Get query param value
 *
 * @param {string} name
 * @param {URLSearchParams} searchParams
 * @returns {boolean}
 */
export const urlGetBool = (name, searchParams = sp) => urlBool(searchParams.get(name))

/** change url parameter and replace current url in addressbar
 *
 * @param {*} name - parameter name
 * @param {*} value - parameter value
 * @returns {void}
 */
export const urlReplace = (name, value) => {
  urlSet(name, value)
  window.history.replaceState(null, null, main.toString())
}

/** change url parameter and reload the page
 *
 * @param {*} name - parameter name
 * @param {*} value - parameter value
 * @returns {void}
 */
export const urlReload = (name, value) => {
  if (name) urlSet(name, value)
  const loc = location.toString()
  const newLoc = main.toString()
  if (newLoc === loc) {
    location.reload()
  } else {
    document.location = newLoc
  }
}
