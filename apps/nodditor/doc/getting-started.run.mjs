// Runner for `doc/getting-started.example.jsx`.
//
//   cd apps/nodditor && node doc/getting-started.run.mjs
//
// Same shape as `smoke/*.run.mjs`: the DOM globals (and the library stylesheet) must exist before the
// editor module is evaluated, and the example imports JSX, so it is bundled first. `setupDom()` is the
// shared boot — happy-dom, the two observer stubs happy-dom 14 lacks, and `static/nodditor.css`.
//
// esbuild runs through its **CLI** with inherited stdio: the JS API talks to a long-lived native
// service over pipes, which confined environments deny with EPERM (see `scripts/build-docs.js`).
//
// Paths are resolved from this file, so the runner works from any working directory.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { setupDom } from '../smoke/dom-setup.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '..')

await setupDom()

const require = createRequire(import.meta.url)
const esbuildPkg = require.resolve('esbuild/package.json')
const bin = JSON.parse(readFileSync(esbuildPkg, 'utf8')).bin
const esbuildBin = join(dirname(esbuildPkg), typeof bin === 'string' ? bin : bin.esbuild)

// `tsconfig-custom.json` (an empty config) mirrors the app build: esbuild would otherwise pick up
// `tsconfig.json`, whose `jsx: "preserve"` emits raw JSX.
const outfile = join(appRoot, 'doc/getting-started.bundle.mjs')
const res = spawnSync(
  process.execPath,
  [
    esbuildBin,
    join(here, 'getting-started.example.jsx'),
    `--outfile=${outfile}`,
    '--tsconfig=tsconfig-custom.json',
    '--bundle',
    '--format=esm',
    '--platform=node',
    '--target=esnext',
    '--jsx=automatic',
    '--jsx-import-source=@jsx6',
    '--loader:.js=tsx',
    '--loader:.jsx=tsx',
    '--log-level=warning',
  ],
  { cwd: appRoot, stdio: 'inherit' },
)

if (res.error) throw res.error
if (res.status !== 0) process.exit(res.status ?? 1)

await import(pathToFileURL(outfile).href)
