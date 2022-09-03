import { Jsx6 } from '@jsx6/jsx6'

const monacoMissing = () => {
  throw new Error('Monaco module is missing. Please load monaco module and call setMonacoModule')
}
let monaco = { colorize: monacoMissing, editor: { create: monacoMissing } }

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

export const colorize = (...args) => monaco.editor.colorize(...args)

export const setMonacoModule = m => (monaco = m)
