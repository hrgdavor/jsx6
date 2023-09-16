import { copyTask, parseArgs, watchDir } from '@jsx6/build'
// import { copyTask } from './src_build/copyTask.js'
import { existsSync, mkdirSync, realpathSync } from 'fs'
import liveServer from 'live-server'

import { buildScript } from './buildScript.js'

const srcPath = () => `globalThis.JSX_SRC_ROOT = '${realpathSync('./').replaceAll('\\', '/')}'`

// *************** read parameters **********************
const { dev, port = 5110 } = parseArgs()
const watch = dev
const outDir = dev ? 'build_dev' : 'build'

/******************************* SETUP  *************/
mkdirSync(outDir, { recursive: true })

/**************************** COPY STATIC ASSETS  *************/

if (!existsSync(outDir + '/monaco'))
  copyTask('node_modules/@jsx6/editor-monaco/dist', outDir + '/monaco', { include: ['*'], exclude: [], watch })
if (!existsSync(outDir + '/babel'))
  copyTask('node_modules/@babel/standalone', outDir + '/babel', { include: ['babel.min.js*'], watch })
copyTask('static', outDir, { include: [], exclude: [], watch, filters: [] })

/**************************** BUILD JS  *************/

// both dev and production build use version that loads language dynamically: ChatBox.js
let devOptions = dev ? { jsxDev: true, footer: { js: srcPath() } } : {}
await buildScript('./src', outDir, 'index.jsx', { watch, ...devOptions })
await buildScript('./src', outDir, 'editor.jsx', { watch, ...devOptions })
await buildScript('./src', outDir, 'demistify.jsx', { watch, ...devOptions })
await buildScript('./src', outDir, 'random.tricks.jsx', { watch, ...devOptions })

/**************************** LIVE SERVER  *************/
console.log('liveServer', liveServer)
if (dev) liveServer.start({ root: outDir, port, open: false })
else console.log('*************        BUILD SUCCESS        ***********')
//*/
