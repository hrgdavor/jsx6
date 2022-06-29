import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'null',
    jsxInject: `import {h} from '@jsx6/jsx6'`,
  },
})
