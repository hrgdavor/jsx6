import { Jsx6 } from '@jsx6/jsx6'

const monacoMissing = () => {
  throw new Error('Monaco module is missing. Please load monaco module and call setMonacoModule')
}
let monaco = { colorize: monacoMissing, editor: { create: monacoMissing } }

export const MonacoEditor = (attr = {}) => {
  let el = <div {...attr} />

  el.setValue = function (value) {
    editor.getModel().setValue(value)
  }

  el.getValue = function () {
    return editor.getModel().getValue()
  }

  let editor = (el.editor = monaco.editor.create(el, {
    value: '',
    language: 'javascript',
    automaticLayout: true,
    minimap: {
      enabled: false,
    },
  }))
  return el
}

export const colorize = (...args) => monaco.editor.colorize(...args)

export const setMonacoModule = m => (monaco = m)
