// Runner for `docs/stack/components.example.jsx`.
//
//   node docs/stack/components.run.mjs
//
// The example imports `.jsx` sources and uses custom elements, so it needs two things before it can be
// imported: the JSX transform (esbuild with the same `jsx: 'automatic'` + `jsxImportSource: '@jsx6'`
// pair the apps build with) and a DOM (happy-dom). Both are set up here, in that order — the example
// defines classes that extend `HTMLElement` at module evaluation time.
//
// esbuild is driven through its **CLI** with inherited stdio, not its JS API: the JS API talks to a
// long-lived native service over pipes, which confined environments (this repo's sandbox, and
// `scripts/build-docs.js`) deny with EPERM. Same reason as the comment at the top of build-docs.js.
//
// Paths are resolved from this file, so the runner works from any working directory.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')

// happy-dom globals first: `class Counter extends JsxW` extends HTMLElement when the bundle is
// evaluated, and `customElements.define` needs the registry.
const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
GlobalRegistrator.register({ url: 'http://localhost/' })

const require = createRequire(import.meta.url)
const esbuildPkg = require.resolve('esbuild/package.json')
const bin = JSON.parse(readFileSync(esbuildPkg, 'utf8')).bin
const esbuildBin = join(dirname(esbuildPkg), typeof bin === 'string' ? bin : bin.esbuild)

const outfile = join(repoRoot, '.tmp/docs-stack/components.bundle.mjs')
const res = spawnSync(
  process.execPath,
  [
    esbuildBin,
    join(here, 'components.example.jsx'),
    `--outfile=${outfile}`,
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
  { cwd: repoRoot, stdio: 'inherit' },
)
if (res.error) throw res.error
if (res.status !== 0) process.exit(res.status ?? 1)

await import(pathToFileURL(outfile).href)