import { Jsx6, addToBody, classIf, insert, observeResize } from '@jsx6/jsx6'
import { parse, stringify } from 'mulmd'
import PerfectScrollbar from 'perfect-scrollbar'

import styles2 from '../tutorial.css'
import { FlipFrame } from './FlipFrame'
import { MonacoEditor, colorize } from './MonacoEditor'
import { queueCodeChange } from './applyCodeChange'
import { insertImports } from './markdown/insertImports'
import { extractProvided, markdown } from './markdown/markdown'
import { splitChapters } from './markdown/splitChapters'
import stylesPS from './perfect-scrollbar.css'
import { syncScroll } from './util/syncScroll'

const langMap = { js: 'typescript', jsx: 'typescript' }

const myColorize = (code, lang) => colorize(code, langMap[lang] || lang)
const suffix = (val, suf) => (val !== undefined ? val + suf : '')

export class TutorialRunner extends Jsx6 {
  defCodeRunner = function () {}
  codeRunner
  runnerMap = {}

  onPrepareIframe(listener) {
    return this.iframe.onPrepareIframe(listener)
  }

  registerRunner(code, runner) {
    this.runnerMap[code] = runner
  }

  init() {
    this.compiled.editor.updateOptions({ readOnly: true })
    syncScroll(this.editor.editor, this.compiled.editor)

    this.editor.editor.getModel().onDidChangeContent(event => {
      queueCodeChange(this.iframe, this.editor, { otherEditor: this.compiled, codeRunner: this.codeRunner })
    })

    const ps = (this.mdArea.scroller = new PerfectScrollbar(this.mdArea, {
      wheelSpeed: 2,
      wheelPropagation: true,
      minScrollbarLength: 20,
    }))
    observeResize(this.mdArea, evt => ps.update())
  }

  showMd(md, keepChapter) {
    const mdParsed = parse(md)
    const provided = extractProvided(mdParsed)
    this.chapters = splitChapters(mdParsed)

    this.menuItems.innerHTML = ''
    insert(this.menuItems, this.chapters.map(this.tplChapterButton))

    this.providedMap = provided
    this.showChapter(keepChapter ? this.chapterIndex : 0)
  }

  showChapterPath(path) {
    this.showChapter(this.chapters ? this.chapters.findIndex(c => c.path === path) : -1)
  }

  showChapter(index, move = 0) {
    const { state, chapters, providedMap, runnerMap } = this

    let mdIndex = this.chapterIndex + move
    if (!move) mdIndex = index

    this.chapterIndex = mdIndex
    const mdParsed = mdIndex >= 0 ? chapters[mdIndex] : null

    if (mdParsed) {
      ;[...this.menuItems.children].forEach(c => {
        if (c.getAttribute) {
          const isCurrent = c.getAttribute('path') === mdParsed.path
          classIf(c, 'selected', isCurrent)
          if (isCurrent) this.currentChapterButton = c
        }
      })

      insertImports(mdParsed, providedMap)

      let initialCode = ''
      this.codeRunner = this.defCodeRunner

      mdParsed.sections?.forEach(section => {
        section.lines?.forEach(line => {
          if (!initialCode && line.code) {
            const { info = {} } = line
            if (info.code === 'initial') {
              initialCode = line.lines?.join('\n')
              if (info.runner) {
                const newRunner = runnerMap[info.runner]
                if (runnerMap[info.runner]) {
                  this.codeRunner = newRunner
                } else {
                  console.log('runner_name', info.runner, 'not found, using default')
                }
              }
            }
          }
        })
      })

      // let md = clean(mdParsed)
      let md = stringify(mdParsed, '', true, true)

      this.editor.setValue(initialCode)
      markdown(md, myColorize).then(html => {
        this.md.innerHTML = html
      })
    } else {
      this.md.innerHTML = ''
    }

    state.chapterTitle = mdParsed?.level == 1 ? '' : mdParsed?.title
    state.parentTitle = mdParsed?.level == 1 ? mdParsed?.title : suffix(mdParsed?.parentTitle, ' / ')
    state.disablePrev = mdIndex <= 0
    state.disableNext = !(mdIndex >= 0 && mdIndex < chapters.length - 1)
    setTimeout(() => {
      this.chapterName.focus()
      this.mdArea.scrollTop = 0
      this.mdArea.scroller.update()
    }, 1)
  }

  tpl(h, $state, state) {
    state.menuHidden = true
    const nextChapterClick = () => this.showChapter(0, 1)
    // this declaration is intentionaly here to have access to scope and scoped `h` function
    // nice side-effect of such declaration is that CTRL+R works in vscode to find it
    this.tplChapterButton = chapter => (
      <button
        class="btn"
        level={chapter.level}
        path={chapter.path}
        onclick={() => this.showChapterPath(chapter.path)}
      >
        {chapter.title}
      </button>
    )

    const showMenuClick = evt => {
      const target = this.chapterName
      const style = this.menuItems.style
      setTimeout(() => {
        style.top = target.offsetHeight + 'px'
        style.left = target.offsetLeft + 'px'
        style.width = target.offsetWidth + 'px'
        this.currentChapterButton?.focus()
      }, 0)
    }

    const tplTutorialHeader = (
      <div class="tutorial-menu fxs posr">
        <button class="btn-icon-large" disabled={$state.disablePrev} onclick={() => this.showChapter(0, -1)}>
          &lt;
        </button>
        <button p="chapterName" class="fxcv1 padh05 btn" onclick={showMenuClick}>
          <b style="margin-right: 0.5em">{$state.parentTitle}</b>
          {$state.chapterTitle}
        </button>

        <button
          p="nextButton"
          class="btn-icon-large"
          disabled={$state.disableNext}
          onclick={nextChapterClick}
        >
          &gt;
        </button>
      </div>
    )

    const tplTutorialText = (
      <div class="fx1 owh posr tutorial-section" p="mdArea">
        <div class="tutorial-text pad" p="md"></div>
        <div class="fx fxje pad tutorial-buttons-bottom">
          <button class="btn btn1" disabled={$state.disableNext} onclick={nextChapterClick}>
            Next -&gt;
          </button>
        </div>
      </div>
    )

    addToBody((this.menuItems = <button class="tutorial-menu-pop pad05 fxs fxfc"></button>))

    const tplLayout = (
      <>
        <div class="fx1 c-main owh">
          {/* ---------------- left side  ----------------------- */}
          <div class="c-left fxs1 fxfc owh">
            {tplTutorialHeader}
            {tplTutorialText}

            {/* left bottom */}
            <div class="fxs1 fxfc owh" hidden>
              <div class="fxs1 owh fxfc"></div>
            </div>
          </div>

          {/* ---------------- right side  ----------------------- */}
          <div class="fxs fxfc owh">
            {/* right top */}
            <div class="fxs1 owh">
              <div class="l-b-box-c1">
                <div>Code</div>
                <MonacoEditor p="editor" class="owh" />
              </div>
              <div class="l-b-box-c1">
                <div>Transformed</div>
                <MonacoEditor p="compiled" class="owh" />
              </div>
            </div>

            {/* right bottom */}
            <div class="fxs1 fxfc owh">
              <div class="l-b-box-c1 owh">
                <div>Output</div>
                <FlipFrame p="iframe" class="fxs owh" />
              </div>
            </div>
            {/* END right bottom */}
          </div>
          {/* END ---- right side ----- */}
        </div>
      </>
    )
    return tplLayout
  }
}
