import { insert, Jsx6, observeResize, classIf } from '@jsx6/jsx6'
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
      console.warn('skipping section without parent ', section)
    }
  })
  console.log('chapters', out)
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
    insert(
      this.menuItems,
      this.chapters.map(c => {
        return (
          <div level={c.level} path={c.path} onclick={() => this.showChapterPath(c.path)}>
            {c.title}
          </div>
        )
      }),
    )

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
      console.log('this.menuItems.chlidNodes', [...this.menuItems.children])
      ;[...this.menuItems.children].forEach(c => {
        if (c.getAttribute) {
          console.log(c.getAttribute('path'), mdParsed.path)
          classIf(c, 'selected', c.getAttribute('path') === mdParsed.path)
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

    state.chapterTitle = mdParsed?.title
    state.parentTitle = suffix(mdParsed?.parentTitle, ' / ')
    state.disablePrev = mdIndex <= 0
    state.disableNext = !(mdIndex >= 0 && mdIndex < chapters.length - 1)
  }

  registerRunner(code, runner) {
    this.runnerMap[code] = runner
  }

  tpl(h, $state, state) {
    state.menuHidden = true

    return (
      <>
        <div class="fx1 c-main owh">
          {/* ---------------- left side  ----------------------- */}
          <div class="c-left fxs1 fxfc owh">
            {/* ---------------- menu  ----------------------- */}
            <div class="tutorial-menu fxs">
              <button
                class="bt-icon-large"
                disabled={$state.disablePrev}
                onclick={() => this.showChapter(0, -1)}
              >
                &lt;
              </button>
              <div class="fxcv1 padh05" onclick={() => (state.menuHidden = !state.menuHidden)}>
                <b>{$state.parentTitle}</b>
                {$state.chapterTitle}
                <div hidden={$state.menuHidden} p="menuItems" class="tutorial-menu-pop pad05"></div>
              </div>
              <button
                class="bt-icon-large"
                disabled={$state.disableNext}
                onclick={() => this.showChapter(0, 1)}
              >
                &gt;
              </button>
            </div>

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
