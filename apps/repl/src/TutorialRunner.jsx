import { insert, Jsx6, observeResize, classIf, addToBody } from '@jsx6/jsx6'
import { FlipFrame } from './FlipFrame'
import { MonacoEditor, colorize } from './MonacoEditor'
import { clean, parse, stringify } from 'mulmd'
import { extractProvided, markdown } from './markdown/markdown'
import { syncScroll } from './util/syncScroll'
import { queueCodeChange } from './applyCodeChange'
import PerfectScrollbar from 'perfect-scrollbar'

import styles2 from '../tutorial.css'
import stylesPS from './perfect-scrollbar.css'

const langMap = { js: 'typescript', jsx: 'typescript' }

const myColorize = (code, lang) => colorize(code, langMap[lang] || lang)
const suffix = (val, suf) => (val !== undefined ? val + suf : '')

function trimTitle(title) {
  if (title && title[0] === '#') {
    const idx = title.indexOf(' ')
    title = title.substring(idx + 1)
  }
  return title
}

function splitChapters(mdParsed) {
  const out = []
  let current
  let currentTop
  mdParsed.sections?.forEach((section, i) => {
    if (section.level && section.level < 3) {
      current = {
        title: trimTitle(section.title),
        path: section.info?.path || i + '',
        info: section.info,
        level: section.level,
        sections: [section],
      }
      if (current.level > 1 && currentTop) current.parentTitle = currentTop.title
      if (current.level == 1) currentTop = current
      out.push(current)
    } else if (current) {
      current.sections.push(section)
    } else {
      if (section.title) console.warn('skipping section without parent ', section)
    }
  })
  return out
}

function insertImports(mdParsed, providedMap = {}) {
  mdParsed.sections?.forEach(section => {
    section.lines?.forEach(line => {
      if (line.code !== undefined) {
        const importName = line.info?.import
        if (importName) {
          const provided = providedMap[importName]
          if (provided) {
            line.lines = line.lines.concat(provided.lines)
            line.info = { ...provided.info, ...line.info }
            delete line.info.import
          } else {
            console.log('import not found', importName)
          }
        }
      }
    })
  })
}

export class TutorialRunner extends Jsx6 {
  defCodeRunner = function () {}
  codeRunner
  runnerMap = {}
  init() {
    this.compiled.editor.updateOptions({ readOnly: true })
    syncScroll(this.editor.editor, this.compiled.editor)

    this.editor.editor.getModel().onDidChangeContent(event => {
      queueCodeChange(this.iframe, this.editor, { otherEditor: this.compiled, codeRunner: this.codeRunner })
    })

    const ps = new PerfectScrollbar(this.md, {
      wheelSpeed: 2,
      wheelPropagation: true,
      minScrollbarLength: 20,
    })
    observeResize(this.md, evt => ps.update())
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
      let md = clean(mdParsed)
      md = stringify(md)

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
      this.nextButton.focus()
    }, 1)
  }

  registerRunner(code, runner) {
    this.runnerMap[code] = runner
  }

  tpl(h, $state, state) {
    state.menuHidden = true

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

    const showMenu = evt => {
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
        <button p="chapterName" class="fxcv1 padh05 btn" onclick={showMenu}>
          <b>{$state.parentTitle}</b>
          {$state.chapterTitle}
        </button>

        <button
          p="nextButton"
          class="btn-icon-large"
          disabled={$state.disableNext}
          onclick={() => this.showChapter(0, 1)}
        >
          &gt;
        </button>
      </div>
    )

    addToBody((this.menuItems = <button class="tutorial-menu-pop pad05 fxs fxfc"></button>))

    return (
      <>
        <div class="fx1 c-main owh">
          {/* ---------------- left side  ----------------------- */}
          <div class="c-left fxs1 fxfc owh">
            {/* ---------------- menu  ----------------------- */}
            {tplTutorialHeader}

            {/* ---------------- tutorial text  ----------------------- */}
            <div class="fx1 owh posr tutorial-text pad" p="md"></div>

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
              <div class="fxs1 fxfc owh">
                <div>Output</div>
                <FlipFrame p="iframe" class="fxs1 owh" />
              </div>
            </div>
            {/* END right bottom */}
          </div>
          {/* END ---- right side ----- */}
        </div>
      </>
    )
  }
}
