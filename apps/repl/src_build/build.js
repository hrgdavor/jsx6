import { copyTask, parseArgs } from '@jsx6/build'
// import { copyTask } from './src_build/copyTask.js'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'fs'
import liveServer from 'live-server'

import { buildScript } from './buildScript.js'

const srcPath = () =>
  `globalThis.JSX_SRC_ROOT = '${realpathSync('./').replaceAll('\\', '/')}'`

/** Version of a vendored package, read from its manifest. */
const pkgVersion = name => {
  try {
    return JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8'))
      .version
  } catch {
    return 'unknown'
  }
}

/**
 * Vendored assets (Monaco, Babel) used to be copied only when the target directory was missing, so
 * upgrading either dependency left stale files in `build/` forever (plan/improvement-plan.md P4-11).
 * A stamp file records which versions were copied; a mismatch — or `--force-vendor` — recopies.
 */
const VENDOR_STAMP = '.vendor-versions.json'
const vendorVersions = () =>
  JSON.stringify({
    'editor-monaco': pkgVersion('@jsx6/editor-monaco'),
    'babel-standalone': pkgVersion('@babel/standalone'),
  })

const vendorUpToDate = outDir => {
  if (!existsSync(outDir + '/monaco') || !existsSync(outDir + '/babel'))
    return false
  try {
    return (
      readFileSync(`${outDir}/${VENDOR_STAMP}`, 'utf8') === vendorVersions()
    )
  } catch {
    return false
  }
}

// *************** read parameters **********************
const args = parseArgs()
const { dev, port = 5110 } = args
// parseArgs keeps flags verbatim, so `--force-vendor` arrives as "force-vendor".
const forceVendor = !!(args['force-vendor'] || args.forceVendor)
const watch = dev
const outDir = dev ? 'build_dev' : 'build'

/******************************* SETUP  *************/
mkdirSync(outDir, { recursive: true })

/**************************** COPY STATIC ASSETS  *************/

if (forceVendor || !vendorUpToDate(outDir)) {
  console.log(`copying vendored assets (${vendorVersions()})`)
  copyTask('node_modules/@jsx6/editor-monaco/dist', outDir + '/monaco', {
    include: ['*'],
    exclude: [],
    watch,
  })
  copyTask('node_modules/@babel/standalone', outDir + '/babel', {
    include: ['babel.min.js*'],
    watch,
  })
  writeFileSync(`${outDir}/${VENDOR_STAMP}`, vendorVersions())
}
copyTask('static', outDir, { include: [], exclude: [], watch, filters: [] })

/**************************** BUILD JS  *************/

// both dev and production build use version that loads language dynamically: ChatBox.js
let devOptions = dev ? { jsxDev: true, footer: { js: srcPath() } } : {}
if (dev) {
  // The dev build bakes this machine's absolute path into the bundle; it must never reach a
  // production build, so say so out loud instead of leaving it to be discovered later.
  console.warn(
    `dev build: embedding developer source root ${realpathSync('./')}`,
  )
}
await buildScript('./src', outDir, 'index.jsx', { watch, ...devOptions })
await buildScript('./src', outDir, 'editor.jsx', { watch, ...devOptions })
await buildScript('./src', outDir, 'demistify.jsx', { watch, ...devOptions })
await buildScript('./src', outDir, 'random.tricks.jsx', {
  watch,
  ...devOptions,
})

/**************************** LIVE SERVER  *************/

if (dev) liveServer.start({ root: outDir, port, open: false })
else console.log('*************        BUILD SUCCESS        ***********')
//*/
