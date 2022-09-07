import 'monaco-editor/esm/vs/basic-languages/monaco.contribution'
import 'monaco-editor/esm/vs/editor/editor.all.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/accessibilityHelp/accessibilityHelp.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/iPadShowKeyboard/iPadShowKeyboard.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/inspectTokens/inspectTokens.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneHelpQuickAccess.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/referenceSearch/standaloneReferenceSearch.js'
import 'monaco-editor/esm/vs/language/css/monaco.contribution'
import 'monaco-editor/esm/vs/language/html/monaco.contribution'
import 'monaco-editor/esm/vs/language/json/monaco.contribution'
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution'

export * from 'monaco-editor/esm/vs/editor/editor.api'

const workerMap = {
  editorWorkerService: 'editor',
  css: 'css',
  html: 'html',
  json: 'json',
  typescript: 'ts',
  javascript: 'ts',
  less: 'css',
  scss: 'css',
  handlebars: 'html',
  razor: 'html',
}

// tell monaco environment where worker js files are
export const setPreBuiltWorkerBase = (workerBase, fromCdn) => {
  const getWorkerUrlLocal = (moduleId, label) => `${workerBase}/${workerMap[label]}.worker.js`

  // this trick with 'data:' was added to monaco documentation but then removed
  //
  // HTML5 does not allow cross-domain web workers, so we need to proxy the instantiation of
  // a web worker through a same-domain script
  const getWorkerUrlCdn = (moduleId, label) => {
    const proxyCode = `self.MonacoEnvironment = { baseUrl: '${workerBase}'};
    importScripts('${workerBase}/${workerMap[label]}.worker.js');`

    return `data:text/javascript;charset=utf-8,${encodeURIComponent(proxyCode)}`
  }

  self.MonacoEnvironment = { getWorkerUrl: fromCdn ? getWorkerUrlCdn : getWorkerUrlLocal }
}

export function syncScroll(ed1, ed2) {
  ed1.onDidScrollChange(e => ed2.setScrollTop(e.scrollTop))
  ed2.onDidScrollChange(e => ed1.setScrollTop(e.scrollTop))
}
