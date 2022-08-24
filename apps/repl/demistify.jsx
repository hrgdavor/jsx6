// https://github.com/stacktracejs/stacktrace-gps
// https://github.com/stacktracejs/error-stack-parser

import { insert, errTranslations, setTranslations } from '@jsx6/jsx6'
import { textSeparatorForeground } from 'monaco-editor/esm/vs/platform/theme/common/colorRegistry'

import styles from './editor.css'
import { transformcjs } from './src/babel/transform'
import { runCode } from './src/runner/simpleRunner'
import { TutorialRunner } from './src/TutorialRunner'
import { fetchText } from './src/util/fetchText'

/** can be removed if wanting to cut a little bit on the output size, but get coded error messages */
setTranslations(errTranslations)

/** @type {TutorialRunner} */
const tutorialRunner = (self.APP = <TutorialRunner class="fxs1" />)
insert(document.body, tutorialRunner)

tutorialRunner.defCodeRunner = (code, iframe) => {
  const transformedForRun = transformcjs(code, { filename: 'code_from_editor.js' })
  const codeToRun = transformedForRun.code
  runCode(codeToRun, iframe)
}

tutorialRunner.registerRunner('render_jsx', (code, iframe) => {
  const improved = `import {h,insert} from './jsx2dom.js';const __JSX__ = ${code};\ninsert(document.body,__JSX__)`
  const transformedForRun = transformcjs(improved, { filename: 'code_from_editor.js' })
  const codeToRun = transformedForRun.code
  runCode(codeToRun, iframe)
})

const mdName = 'demistify.jsx.md'
const md = await fetchText('./' + mdName)
tutorialRunner.showMd(md)

if (import.meta.hot) {
  import.meta.hot.on('md-update', data => {
    if (data.file.includes(mdName)) {
      tutorialRunner.showMd(data.content, true)
    }
    // console.log('md-update', data)
  })
}
