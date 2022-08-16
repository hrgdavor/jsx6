import { Jsx6 } from '@jsx6/jsx6'
import { monaco } from './customMonaco'
// import * as monaco from 'monaco-editor'

export class MonacoEditor extends Jsx6 {
  setValue(value) {
    this.editor.getModel().setValue(value)
  }

  getValue() {
    return this.editor.getModel().getValue()
  }

  init() {
    this.editor = monaco.editor.create(this.el, {
      value: '',
      language: 'javascript',
      automaticLayout: true,
      minimap: {
        enabled: false,
      },
    })
  }
}
