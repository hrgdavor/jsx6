// https://github.com/stacktracejs/stacktrace-gps
// https://github.com/stacktracejs/error-stack-parser

import { insert, Jsx6 } from '@jsx6/jsx6'
import { FlipFrame } from './src/FlipFrame'
import { transform } from './src/transform'
import { MonacoEditor } from './src/MonacoEditor'

import styles from './editor.css'

class Editor extends Jsx6 {
  init() {
    this.compiled.editor.updateOptions({ readOnly: true })
    function syncScroll(ed1, ed2) {
      ed1.onDidScrollChange(e => ed2.setScrollTop(e.scrollTop))
      ed2.onDidScrollChange(e => ed1.setScrollTop(e.scrollTop))
    }
    syncScroll(this.editor.editor, this.compiled.editor)
  }

  tpl(h, state, $state) {
    return (
      <>
        <div class="fx1 c-main owh">
          {/* ---------------- left side  ----------------------- */}
          <div class="c-left fx1 pad owh">
            <h1>Title</h1>
            <p>Bla bla</p>
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
              <div class="fxs1 owh">
                <FlipFrame p="iframe" class="fx1" hidden />
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

insert(document.body,<h3>Hello World!{/* comment in jsx*/}</h3>)


console.log('aaaaa')


console.log('aaaaa')
`
editor.editor.setValue(code)

applyCodeChange(code)

let changeTimer
editor.editor.editor.getModel().onDidChangeContent(event => {
  console.log('code change', event)
  clearTimeout(changeTimer)
  changeTimer = setTimeout(() => {
    applyCodeChange(editor.editor.getValue())
  }, 300)
})

function applyCodeChange(code) {
  let time = performance.now()
  const codeTransformed = transform(code, {}).code
  let timeTransform1 = performance.now()
  const codeToRun = transform(code, {}, { plugins: ['transform-modules-commonjs'] }).code
  let timeTransform2 = performance.now()

  editor.compiled.setValue(codeTransformed + '\n')

  console.log(code)
  console.log(timeTransform1 - time, codeTransformed)
  console.log(timeTransform2 - time, codeToRun)
}
