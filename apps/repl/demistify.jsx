// https://github.com/stacktracejs/stacktrace-gps
// https://github.com/stacktracejs/error-stack-parser
import { errTranslations, insert, setTranslations } from '@jsx6/jsx6'

import styles from './editor.css'
import { setMonacoModule } from './src/MonacoEditor'
import { TutorialRunner } from './src/TutorialRunner'
import { setBabelModule, transformcjs } from './src/babel/transform'
import { runCode } from './src/runner/simpleRunner'
import { fetchText } from './src/util/fetchText'

/** can be removed if wanting to cut a little bit on the output size, but get coded error messages */
setTranslations(errTranslations)
self._mark = 'MAIN'
const injectStyle = iframe => {
  insert(
    iframe.contentDocument.head,
    <style>{`
@import url(https://fonts.googleapis.com/css?family=Roboto:400,100,100italic,300,300ita‌​lic,400italic,500,500italic,700,700italic,900italic,900);
html, body {
  font-family: 'Roboto', sans-serif;
  width:100%;
  height:100%;
  padding:0;
  margin:0;
  box-sizing: border-box;
}  
body{
  padding: 20px;
}
  `}</style>,
  )
}

// we load iife babel andd supply it to our transform utility
setBabelModule(Babel)

// we loaded pre-built monaco that exposes global variable: 'monaco'
// give reference to monaco module
// this way MonacoEditor component can be declared and used while
// loading of monaco is not done as depenedency but handled externally
setMonacoModule(monaco)

// tell monaco environment where worker js files are
const base = './monaco'
const workerMap = {
  editorWorkerService: 'editor',
  css: 'css',
  html: 'html',
  json: 'json',
  typescript: 'ts',
  javascript: 'ts',
  less: 'css',
  scss: 'css',
  handlebars: 'html',
  razor: 'html',
}

self.MonacoEnvironment = { getWorkerUrl: (moduleId, label) => `${base}/${workerMap[label]}.worker.js` }

/** @type {TutorialRunner} */
const tutorialRunner = (self.APP = <TutorialRunner class="fxs1" />)
insert(document.body, tutorialRunner)
tutorialRunner.onPrepareIframe(injectStyle)

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
fetchText('./' + mdName).then(md => {
  tutorialRunner.showMd(md)
})

if (import.meta.hot) {
  import.meta.hot.on('md-update', data => {
    if (data.file.includes(mdName)) {
      tutorialRunner.showMd(data.content, true)
    }
    // console.log('md-update', data)
  })
}
