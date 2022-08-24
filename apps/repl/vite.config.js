import { defineConfig } from 'vite'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'
import CustomHmr from './CustomHmr.js'

export default defineConfig({
  plugins: [
    monacoEditorPlugin.default({
      //  languageWorkers: ['editorWorkerService', 'typescript'],
    }),
    CustomHmr(),
  ],
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'null',

    // jsxInject: ``,
    // available in esbuild since 0.7.17
    jsxInject: `import {h} from '@jsx6/jsx6'`,
    // --inject:shim.js
    // shim.js: export { h } from '@jsx6/jsx6'
    // esbuild index.jsx --outdir=dist --bundle --loader:.ttf=file --jsx-factory=h --jsx-fragment=null --sourcemap --inject:shim.js
  },
  build: {
    sourcemap: true,
  },
  define: {
    'process.env': process.env,
  },
  server: {
    fs: {
      // Allow serving files from node modules that are in rush common folder
      allow: ['../..'],
    },
  },
})
