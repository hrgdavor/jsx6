#!/usr/bin/env bun
/**
 * The signal-inspection demo: build it, then serve it on a URL you can open in a browser.
 *
 *   bun experiments/signal-inspect/serve.js                 # build + serve on 127.0.0.1:5310
 *   bun experiments/signal-inspect/serve.js --port=5320
 *   bun experiments/signal-inspect/serve.js --build-only    # just (re)build dist/demo.js
 *
 * The bundle is **not minified** on purpose: the point of the page is to inspect this library from the
 * dev console, so the Sources panel should be readable, and the sourcemap is there for stepping.
 *
 * Both cores (`@jsx6/signal` and `@jsx6/signal-alien`) are bundled into the one page so the inspection
 * affordance can be compared side by side; the page has a switch for which one is active.
 */

import { existsSync, mkdirSync, statSync } from 'fs'
import { extname, join, normalize, resolve } from 'path'
import * as esbuild from 'esbuild'

const HERE = import.meta.dir
const ROOT = resolve(HERE, '../..')
const OUT_DIR = join(HERE, 'dist')
const OUT_FILE = join(OUT_DIR, 'demo.js')

const args = process.argv.slice(2)
const portArg = args.find(a => a.startsWith('--port='))
const port = portArg ? Number(portArg.split('=')[1]) : 5310
const buildOnly = args.includes('--build-only')

export async function build() {
  mkdirSync(OUT_DIR, { recursive: true })
  const result = await esbuild.build({
    entryPoints: [join(HERE, 'demo-src.js')],
    bundle: true,
    format: 'esm',
    target: 'es2020',
    outfile: OUT_FILE,
    sourcemap: true,
    absWorkingDir: ROOT,
    logLevel: 'error',
    metafile: true,
  })
  const bytes = statSync(OUT_FILE).size
  const inputs = Object.keys(result.metafile.inputs).filter(p => p.includes('signal'))
  console.log(`built dist/demo.js  ${(bytes / 1024).toFixed(1)} kB`)
  console.log(`  bundles both cores: ${inputs.filter(i => i.includes('libs/')).join(', ')}`)
  return OUT_FILE
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

/**
 * The generated bundle lives in `dist/`, but the page asks for `/demo.js` — the URL a reader would
 * guess, and the one that shows up next to index.html in the Sources panel.
 */
const ROUTES = {
  '/demo.js': join(OUT_DIR, 'demo.js'),
  '/demo.js.map': join(OUT_DIR, 'demo.js.map'),
}

/** Serves this directory (and only this directory) read-only. */
function serve(portNumber) {
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: portNumber,
    fetch(request) {
      const url = new URL(request.url)
      const pathname = url.pathname === '/' ? '/index.html' : url.pathname
      const file = ROUTES[pathname] ?? normalize(join(HERE, decodeURIComponent(pathname)))

      // Path traversal guard: nothing outside this directory (or the bundle route) is reachable.
      if (!file.startsWith(HERE)) return new Response('forbidden', { status: 403 })
      if (!existsSync(file) || statSync(file).isDirectory()) {
        return new Response(`not found: ${pathname}`, { status: 404 })
      }
      return new Response(Bun.file(file), {
        headers: { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' },
      })
    },
  })
  return server
}

if (import.meta.main) {
  await build()
  if (buildOnly) process.exit(0)

  const server = serve(port)
  console.log(`\nopen  http://127.0.0.1:${server.port}/`)
  console.log('then open DevTools — the signals are already logged, and typed at:')
  console.log('  $count  $double  $eager  $sum  $user  $static  $duck  core')
  console.log('\nstop with Ctrl+C')
}