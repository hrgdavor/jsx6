/** Verifies the served demo page: HTTP status, content type, and that the bundle is the real thing. */
const base = 'http://127.0.0.1:5310'
for (const path of ['/', '/index.html', '/demo.js', '/demo.js.map', '/README.md', '/../package.json']) {
  try {
    const r = await fetch(base + path, { signal: AbortSignal.timeout(8000) })
    const t = await r.text()
    const marker = path === '/demo.js' ? ` coreSwitch=${/signal-alien/.test(t)} getter=${/defineProperty\([^)]*"value"/.test(t)}` : ''
    console.log(`${path.padEnd(18)} ${r.status} ${r.headers.get('content-type')?.split(';')[0] ?? ''} ${t.length} B${marker}`)
  } catch (e) {
    console.log(`${path.padEnd(18)} FAILED ${e.message}`)
  }
}
const html = await (await fetch(base + '/')).text()
console.log('html references /demo.js:', html.includes('src="/demo.js"'))
console.log('html has all buttons:', ['#write', '#log', '#facts', '#logs', '#cyclic', '#dispose', '#alienNode', '#values'].every(id => html.includes(id.replace('#', 'id="')) || html.includes(id)))