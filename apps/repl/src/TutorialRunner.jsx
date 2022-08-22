import { Jsx6 } from '@jsx6/jsx6'
import { FlipFrame } from './FlipFrame'
import { MonacoEditor, colorize } from './MonacoEditor'
import { clean, parse, stringify } from 'mulmd'
import { extractProvided, markdown } from './markdown/markdown'
import { syncScroll } from './util/syncScroll'
import { queueCodeChange } from './applyCodeChange'
import { runCode } from './runner/simpleRunner'

export class TutorialRunner extends Jsx6 {
  codeRunner = runCode
  init() {
    this.compiled.editor.updateOptions({ readOnly: true })
    syncScroll(this.editor.editor, this.compiled.editor)

    this.editor.editor.getModel().onDidChangeContent(event => {
      queueCodeChange(this.iframe, this.editor, { otherEditor: this.compiled, codeRunner: this.codeRunner })
    })
  }

  showMd(md) {
    const mdParsed = parse(md)
    const provided = extractProvided(mdParsed)
    console.log('mdParsed', mdParsed)
    console.log('provided', provided)

    md = clean(mdParsed)
    console.log('cleaned', md)
    md = stringify(md)
    console.log('md', md)
    markdown(md, colorize).then(html => {
      this.md.innerHTML = html
    })
  }

  tpl(h, state, $state) {
    return (
      <>
        <div class="fx1 c-main owh">
          {/* ---------------- left side  ----------------------- */}
          <div class="c-left fxs1 fxfc pad owh">
            <div class="fx1 owa" p="md"></div>
            {/* left bottom */}
            <div class="fxs1 fxfc owh" hidden>
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
