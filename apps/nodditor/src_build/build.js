import { copyTask, parseArgs, watchDir } from '@jsx6/build'
// import { copyTask } from './src_build/copyTask.js'
import { mkdirSync, realpathSync } from 'fs'
import liveServer from 'live-server'

import { buildScript } from './buildScript.js'

const srcPath = () => `globalThis.JSX_SRC_ROOT = '${realpathSync('./').replaceAll('\\', '/')}'`

// *************** read parameters **********************
const { dev, port = 5111 } = parseArgs()
const watch = dev
const outDir = dev ? 'build_dev' : 'build'

/******************************* SETUP  *************/
mkdirSync(outDir, { recursive: true })

/**************************** COPY STATIC ASSETS  *************/

copyTask('static', outDir, { include: [], exclude: [], watch, filters: [] })

/**************************** BUILD JS  *************/

// both dev and production build use version that loads language dynamically: ChatBox.js
let devOptions = dev ? { jsxDev: true, footer: { js: srcPath() } } : {}
await buildScript('./src', outDir, 'index.jsx', { watch, ...devOptions })

/**************************** LIVE SERVER  *************/

if (dev) liveServer.start({ root: outDir, port, open: false })
else console.log('*************        BUILD SUCCESS        ***********')
//*/
