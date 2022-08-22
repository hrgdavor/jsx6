// https://github.com/stacktracejs/stacktrace-gps
// https://github.com/stacktracejs/error-stack-parser

import { insert } from '@jsx6/jsx6'

import styles from './editor.css'
import { TutorialRunner } from './src/TutorialRunner'

const codeMark = '```'
export const mdSample = `## h1
({"id":1})

bla bla

${codeMark}javascript
({"id":1})
import { h, Jsx6, insert } from '@jsx6/jsx6'

var x = 1;
${codeMark}
..
${codeMark}javascript
function test(a,b){
return a+b
}
${codeMark}    
      `
const code = `import { h, Jsx6, insert } from '@jsx6/jsx6'

insert(document.body,<>
  <h3>Hello World!</h3>
  <div>Counter:</div>
</>)




`

/** @type {TutorialRunner} */
const editor = (self.APP = <TutorialRunner class="fxs1" />)
insert(document.body, editor)

editor.editor.setValue(code)
editor.showMd(mdSample)

//applyCodeChange(code)
