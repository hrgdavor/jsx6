import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

import CustomHmr from './CustomHmr.js'

const exclude = []

export default defineConfig({
  base: '',
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@jsx6/editor-monaco/dist/*',
          dest: 'monaco',
        },
        {
          src: 'node_modules/@babel/standalone/babel.min.js*',
          dest: 'babel',
        },
      ],
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
    rollupOptions: {
      input: {
        main: './index.html',
        demistify: './demistify.jsx.html',
        demistify_online: './demistify.jsx.online.html',
      },
      external: exclude,
    },
  },
  optimizeDeps: {
    exclude,
  },
  define: {
    'process.env': process.env,
  },
  // this was needed while using monaco as dependency
  // server: {
  //   fs: {
  //     // Allow serving files from node modules that are in rush common folder
  //     allow: ['../..'],
  //   },
  // },
})
