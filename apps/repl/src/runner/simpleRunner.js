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
  win.requireFile = requireFile
  win.require = require
  win.requireModule = requireModule
  win.eval(code)
}
