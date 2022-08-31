import { transformcjs } from '../babel/transform'

export function requireFile(url) {
  var X = new XMLHttpRequest()
  X.open('GET', url, 0) // sync
  X.send()
  if (X.status && X.status !== 200) throw new Error(X.statusText)
  return X.responseText
}

export function require(url) {
  //if (url.toLowerCase().substr(-3)!=='.js') url+='.js'; // to allow loading without js suffix;
  if (require.urlAlias[url]) url = require.urlAlias[url]
  if (!url.startsWith('http')) {
    if (url.startsWith('./')) {
      //throw new Error('local files not supported')
    } else {
      url = 'https://unpkg.com/' + url
    }
  }
  if (!this.___require_cache) this.___require_cache = {}
  var exports = this.___require_cache[url] //get from cache
  if (!exports) {
    //not cached
    let module = this.requireModule(url)
    this.___require_cache[url] = exports = module.exports //cache obj exported by module
  }
  return exports //require returns object exported by module
}
export function requireModule(url, source) {
  try {
    const exports = {}
    source = source || this.requireFile(url)
    source = transformcjs(source, { filename: '' + url }).code
    const module = { id: url, uri: url, exports: exports, source } //according to node.js modules

    // fix, add comment to show source on Chrome Dev Tools
    //source="//@ sourceURL="+window.location.origin+url+"\n" + source;
    //------
    // is is important to attach these functions to iframe so this can be used to
    // call Function that is part of that widnow. Otherwise document.body or such calls would reference main window
    const anonFn = new this.Function('require', 'exports', 'module', source).bind(this) //create a Fn with module code, and 3 params: require, exports & module
    anonFn(require, exports, module) // call the Fn, Execute the module
    return module
  } catch (err) {
    console.error('Error loading module ' + url + ': ' + err.message + '\n', err.stack, err)
    console.log(source)
    throw err
  }
}
require.cache = {}
require.urlAlias = {}
require.alias = (alias, orig) => {
  const cache = require.cache
  cache[alias] = cache[orig]
  if (alias.toLowerCase().substr(-3) !== '.js') require.cache[alias + '.js'] = cache[orig]
  require.urlAlias[alias] = orig
}
require.alias('@jsx6/jsx6', './dist/jsx6.js')
