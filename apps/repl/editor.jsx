// https://github.com/stacktracejs/stacktrace-gps
// https://github.com/stacktracejs/error-stack-parser

import { appendChild, domWithScope, insertBefore, Jsx6, setVisible } from '@jsx6/jsx6'
import { FlipFrame } from './src/FlipFrame'
import { transform } from './src/transform'

import styles from './editor.css'

class Editor extends Jsx6{

  tpl(h, state, $state){
    return <>
      <FlipFrame p="iframe" class="c-iframe"/>
    </>
  }
}

const editor = self.APP = insertBefore(document.body,<Editor/>)

self.doTest2 = ()=>{
  let time = performance.now()
  APP.iframe.counter = (APP.iframe.counter || 0) + 1
  APP.iframe.waitNext().then(iframe=>{
    console.log('reloaded', performance.now() - time, iframe.__mark)
    insertBefore(iframe.contentWindow.document.body,<h1>Hello iframe {iframe.loadCounter} / {APP.iframe.counter}</h1>)
  });
}
const code = `import { h, Jsx6, appendChild } from '@jsx6/jsx6'
 const hello2 = <div>Hello {name}!</div>
 const hello3 = <div>Hello {name}!</div>
 export const hello = <div>Hello {name}!</div>
`
// console.log(code)
// console.log(transform(code, {}).code,)
// console.log(transform(code, {},{plugins:['transform-modules-commonjs']}).code,)






