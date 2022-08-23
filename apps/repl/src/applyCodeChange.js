import { transform, transformcjs } from './babel/transform'
import { addLinesToMatchCount } from './util/addLinesToMatchCount'
import { runCode } from './runner/simpleRunner'

let changeTimer
let defApplyCodeDelay = 100
const maxApplyCodeDelay = 1000
let applyCodeDelay = defApplyCodeDelay

export function queueCodeChange(iframe, editor, { otherEditor, codeRunner = runCode }) {
  clearTimeout(changeTimer)
  changeTimer = setTimeout(() => {
    try {
      applyCodeChange(iframe, editor, { otherEditor, codeRunner })
    } catch (error) {
      applyCodeDelay = maxApplyCodeDelay
      throw error
    }
  }, applyCodeDelay)
}

function applyCodeChange(iframe, editor, { otherEditor, codeRunner = runCode }) {
  const code = editor.getValue()
  let codeTransformed = otherEditor ? transform(code, {}).code : ''

  if (otherEditor) {
    codeTransformed = addLinesToMatchCount(code, codeTransformed)
    otherEditor.setValue(codeTransformed)
  }

  iframe.waitNext().then(iframe => {
    try {
      let time = Date.now()
      codeRunner(code, iframe)
      time = Date.now() - time
      if (time >= defApplyCodeDelay - 10) {
        time = Math.min(time + defApplyCodeDelay, maxApplyCodeDelay)
      } else {
        applyCodeDelay = defApplyCodeDelay
      }
    } catch (error) {
      const newLocal = maxApplyCodeDelay
      applyCodeDelay = newLocal
      throw error
    }
  })
}
