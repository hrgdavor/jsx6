// https://github.com/stacktracejs/stacktrace-gps
// https://github.com/stacktracejs/error-stack-parser

import { insert, Jsx6 } from '@jsx6/jsx6'
import { FlipFrame } from './src/FlipFrame'
import { transform } from './src/babel/transform'
import { MonacoEditor, colorize } from './src/MonacoEditor'

import styles from './editor.css'
import { markdown } from './src/markdown/markdown'

class Editor extends Jsx6 {
  init() {
    this.compiled.editor.updateOptions({ readOnly: true })
    function syncScroll(ed1, ed2) {
      ed1.onDidScrollChange(e => ed2.setScrollTop(e.scrollTop))
      ed2.onDidScrollChange(e => ed1.setScrollTop(e.scrollTop))
    }
    syncScroll(this.editor.editor, this.compiled.editor)

    const codeMark = '```'
    const mdSample = `
## h1

bla bla

${codeMark}javascript
import { h, Jsx6, insert } from '@jsx6/jsx6'

var x = 1;
${codeMark}

${codeMark}javascript
function test(a,b){
  return a+b
}
${codeMark}    
        `

    markdown(mdSample, colorize).then(html => {
      this.md.innerHTML = html
    })
  }

  tpl(h, state, $state) {
    return (
      <>
        <div class="fx1 c-main owh">
          {/* ---------------- left side  ----------------------- */}
          <div class="c-left fxs1 fxfc pad owh">
            <div class="fx1 owa" p="md">
              <h1>Title</h1>
              <p>Bla bla</p>
            </div>
            {/* left bottom */}
            <div class="fxs1 fxfc owh">
              <div class="fxs1 owh fxfc"></div>
            </div>
          </div>

          {/* ---------------- right side  ----------------------- */}
          <div class="fxs fxfc owh">
            {/* right top */}
            <div class="fxs1 owh">
              <MonacoEditor p="editor" class="fx1 owh" />
              <MonacoEditor p="compiled" class="fx1 owh" />
            </div>

            {/* right bottom */}
            <div class="fxs1 fxfc owh">
              <div class="fx1 owh">
                <div>Output</div>
                <FlipFrame p="iframe" class="fx1" />
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }
}

const editor = (self.APP = insert(document.body, <Editor class="fxs1" />))

self.doTest2 = () => {
  let time = performance.now()
  APP.iframe.counter = (APP.iframe.counter || 0) + 1
  APP.iframe.waitNext().then(iframe => {
    console.log('reloaded', performance.now() - time, iframe.__mark)
    insert(
      iframe.contentWindow.document.body,
      <h1>
        Hello iframe {iframe.loadCounter} / {APP.iframe.counter}
      </h1>,
    )
  })
}
const code = `import { h, Jsx6, insert } from '@jsx6/jsx6'

insert(document.body,<>
  <h3>Hello World!</h3>
  <div>Counter:</div>
</>)




`
editor.editor.setValue(code)

const countLines = str => {
  let length = 0
  for (let i = 0; i < str.length; ++i) {
    if (str[i] == '\n') {
      length++
    }
  }
  return length
}

applyCodeChange(code)

let changeTimer
let defApplyCodeDelay = 100
let applyCodeDelay = defApplyCodeDelay
editor.editor.editor.getModel().onDidChangeContent(event => {
  clearTimeout(changeTimer)
  changeTimer = setTimeout(() => {
    try {
      applyCodeChange(editor.editor.getValue())
      applyCodeDelay = defApplyCodeDelay
    } catch (error) {
      applyCodeDelay = 1000
      throw error
    }
  }, applyCodeDelay)
})

function applyCodeChange(code) {
  let time = performance.now()
  let codeTransformed = transform(code, {}).code
  let timeTransform1 = performance.now()
  const transformedForRun = transform(code, {}, { plugins: ['transform-modules-commonjs'] })
  const codeToRun = transformedForRun.code
  let timeTransform2 = performance.now()

  const count1 = countLines(code)
  const count2 = countLines(codeTransformed)

  if (count1 > count2) {
    const arr = [codeTransformed]
    for (let i = count2; i < count1; i++) arr.push('\n')
    codeTransformed = arr.join('')
  }

  editor.compiled.setValue(codeTransformed)

  // console.log(code)
  // console.log(timeTransform1 - time, codeTransformed)
  // console.log(timeTransform2 - time, codeToRun)

  editor.iframe.waitNext().then(iframe => {
    try {
      runCode(codeToRun, iframe, code, transformedForRun.map)
      applyCodeDelay = defApplyCodeDelay
    } catch (error) {
      applyCodeDelay = 1000
      throw error
    }
  })
}

function runCode(code, iframe, source) {
  // console.log('codeToRun', code, iframe)
  console.log(
    `
****************************************
**********************  RUN CODE  ******
****************************************
`,
  )
  const win = iframe.contentWindow
  win.__mark = 'iframe_win'
  self.__mark = 'main_win'
  win.requireFile = requireFile
  win.require = require
  win.requireModule = requireModule
  win.eval(code)
}

function requireFile(url) {
  var X = new XMLHttpRequest()
  X.open('GET', url, 0) // sync
  X.send()
  if (X.status && X.status !== 200) throw new Error(X.statusText)
  return X.responseText
}

function require(url) {
  //if (url.toLowerCase().substr(-3)!=='.js') url+='.js'; // to allow loading without js suffix;
  if (require.urlAlias[url]) url = require.urlAlias[url]
  if (!url.startsWith('http')) {
    if (url.startsWith('./')) {
      //throw new Error('local files not supported')
    } else {
      url = 'https://unpkg.com/' + url
    }
  }
  var exports = require.cache[url] //get from cache
  if (!exports) {
    //not cached
    let module = requireModule(url)
    require.cache[url] = exports = module.exports //cache obj exported by module
  }
  return exports //require returns object exported by module
}

function requireModule(url, source) {
  try {
    const exports = {}
    source = source || requireFile(url)
    const module = { id: url, uri: url, exports: exports, source } //according to node.js modules
    // fix, add comment to show source on Chrome Dev Tools
    //source="//@ sourceURL="+window.location.origin+url+"\n" + source;
    //------
    const anonFn = new Function('require', 'exports', 'module', source) //create a Fn with module code, and 3 params: require, exports & module
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
