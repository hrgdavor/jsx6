#!/usr/bin/env bun
/** Quick size-only run, for iterating on `size.js` without generating the full report. */

import { measureAlienBaseline, measureAppEntries, measureSizes } from './size.js'

const kb = n => `${(n / 1024).toFixed(1)} kB`
const ids = ['baseline', 'a-compat', 'b-native-computed', 'c-alien-backend', 'e-alien-native', 'f-bridge-hybrid']

const sizes = await measureSizes(ids)
console.log('direction                 core plain   core min   core gzip   +computed min   +computed gzip')
for (const r of sizes) {
  console.log(
    `${r.id.padEnd(24)} ${kb(r.core.plainBytes).padEnd(11)} ${kb(r.core.minBytes).padEnd(10)} ${kb(r.core.gzipBytes).padEnd(11)} ` +
      `${(r.computed ? kb(r.computed.minBytes) : 'n/a').padEnd(15)} ${r.computed ? kb(r.computed.gzipBytes) : 'n/a'}`,
  )
}

const alien = await measureAlienBaseline()
console.log(`\nalien-signals alone      plain ${kb(alien.plainBytes)} · min ${kb(alien.minBytes)} · gzip ${kb(alien.gzipBytes)}`)

const app = await measureAppEntries(['baseline', 'b-native-computed', 'c-alien-backend'])
console.log('\napp index.js             plain      min        gzip(min)  gzip(plain)')
for (const r of app) {
  if (r.missing) {
    console.log(`${r.id.padEnd(24)} (not built — run d-dual-surface/app-compare.js)`)
    continue
  }
  console.log(
    `${r.id.padEnd(24)} ${kb(r.plainBytes).padEnd(10)} ${kb(r.minBytes).padEnd(10)} ${kb(r.gzipBytes).padEnd(10)} ${kb(r.gzipPlainBytes)}`,
  )
}