import { Jsx6 } from '@jsx6/jsx6'
import { monaco } from './customMonaco'
// import * as monaco from 'monaco-editor'

console.log('monaco', monaco)

export class Editor extends Jsx6{
  init(){
    setTimeout(() => {      
      monaco.editor.create(this.el, {
        value: "function hello() {\n\talert('Hello world!');\n}",
        language: 'javascript',
        minimap: {
          enabled: false
        }
      })
    }, 0);
  }
}

