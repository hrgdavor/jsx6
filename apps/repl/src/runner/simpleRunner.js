import { require, requireFile, requireModule } from './require'

export function runCode(code, iframe) {
  // console.log('codeToRun', code, iframe)
  console.log(
    `
****************************************
**********************  RUN CODE  ******
****************************************
`,
  )
  const win = iframe.contentWindow
  win.requireFile = requireFile.bind(win)
  win.require = require.bind(win)
  win.requireModule = requireModule.bind(win)
  win.eval(code)
}
