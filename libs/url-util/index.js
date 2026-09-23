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

/**
 * The parsed location is created lazily: doing `new URL(location.toString())` at module scope
 * threw outside a browser and stayed permanently stale after SPA navigation
 * (plan/improvement-plan.md P2-5). Call {@link refreshUrl} after the URL changes without a reload.
 *
 * @type {URL|null}
 */
let main = null

/** @returns {URL} */
const getMain = () => {
  if (!main) {
    if (typeof location === 'undefined') {
      throw new Error('@jsx6/url-util needs a browser location; call setUrl() outside a browser')
    }
    main = new URL(location.toString())
  }
  return main
}

/**
 * Re-read the current location. Use after history navigation that does not reload the page.
 *
 * @returns {URL}
 */
export const refreshUrl = () => {
  main = null
  return getMain()
}

/**
 * Use an explicit URL instead of the browser location (useful in tests and outside a browser).
 *
 * @param {string|URL} url
 * @returns {URL}
 */
export const setUrl = url => {
  main = new URL(url.toString())
  return main
}

/**
 * string with current value of main url
 * @returns {string}
 */
export const urlStr = () => getMain().toString()

/**
 * @returns {URLSearchParams}
 */
const sp = () => getMain().searchParams

/** Get value of a parameter, and if not present use the provided default and return it.
 *
 * @param {string} name
 * @param {string} def - default value
 * @param {URLSearchParams} [searchParams]
 * @returns {string}
 */
export function urlInit(name, def, searchParams = sp()) {
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
 * @param {URLSearchParams} [searchParams]
 * @returns {void}
 */
export function urlSet(name, value, searchParams = sp()) {
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
 * @param {URLSearchParams} [searchParams]
 * @returns {string}
 */
export const urlGet = (name, searchParams = sp()) => searchParams.get(name)

/** Boolean variant. Get value of a parameter, and if not present use the provided default and return it.
 *
 * @param {string} name
 * @param {string} def - default value
 * @param {URLSearchParams} [searchParams]
 * @returns {boolean}
 */
export const urlInitBool = (name, def, searchParams = sp()) => urlBool(urlInit(name, def, searchParams))

/** Boolean variant. Get query param value
 *
 * @param {string} name
 * @param {URLSearchParams} [searchParams]
 * @returns {boolean}
 */
export const urlGetBool = (name, searchParams = sp()) => urlBool(searchParams.get(name))

/** change url parameter and replace current url in addressbar
 *
 * @param {*} name - parameter name
 * @param {*} value - parameter value
 * @returns {void}
 */
export const urlReplace = (name, value) => {
  urlSet(name, value)
  window.history.replaceState(null, null, getMain().toString())
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
  const newLoc = getMain().toString()
  if (newLoc === loc) {
    location.reload()
  } else {
    document.location = newLoc
  }
}
