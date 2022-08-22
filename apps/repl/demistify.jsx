// https://github.com/stacktracejs/stacktrace-gps
// https://github.com/stacktracejs/error-stack-parser

import { insert } from '@jsx6/jsx6'
import { textSeparatorForeground } from 'monaco-editor/esm/vs/platform/theme/common/colorRegistry'

import styles from './editor.css'
import { TutorialRunner } from './src/TutorialRunner'
import { fetchText } from './src/util/fetchText'

/** @type {TutorialRunner} */
const tutorialRunner = (self.APP = <TutorialRunner class="fxs1" />)
insert(document.body, tutorialRunner)
tutorialRunner.codeRunner = (...args) => {
  console.log('run code ', ...args)
}

const md = await fetchText('./demistify.jsx.md')
tutorialRunner.showMd(md)
