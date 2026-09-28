/**
 * Boot smoke test — evaluates the real demo page modules under happy-dom.
 *
 * Why this exists: every other suite constructs `NodeEditor` itself, so nothing loaded the DEMO PAGE
 * modules. A module-level mistake there (a missing import, a renamed binding) threw
 * `ReferenceError: backend is not defined` on startup in the browser while all tests stayed green.
 * This suite is the one that catches that.
 *
 * The page is evaluated as a SEPARATE bundle (`boot-page.bundle.mjs`, built by boot.run.mjs) because
 * that is how a browser evaluates it: its module body — not just its exports — has to run without
 * throwing.
 *
 * Known limit: happy-dom 14 cannot host the full JSX demo page's node tree. Its `querySelector`
 * throws on an entry with `tagName: null` (a node happy-dom itself created for a component wrapper),
 * so the assertions stop at "the module body ran"; the editor's own suites cover everything after
 * that. Run this in a browser (`bun start`) to eyeball the rest.
 */
import { NodeEditor } from '../src/NodeEditor.jsx'
import { startVanillaDemo } from '../static/vanilla/demo.js'

/**
 * happy-dom 14 has no layout, and its CSS engine throws on `getComputedStyle(el)
 * .getPropertyValue('--offset-x')` for an element it cannot place. Connector discovery reads exactly
 * those two custom properties, so this suite must not depend on that engine — it stubs the two
 * custom properties and leaves everything else of the editor real.
 */
globalThis.getComputedStyle = () => ({
  getPropertyValue: () => '',
  zIndex: 'auto',
  pointerEvents: 'auto',
})

let failures = 0
const ok = (cond, msg) => {
  if (cond) console.log('ok   ' + msg)
  else {
    failures++
    console.error('FAIL ' + msg)
  }
}
const tick = (ms = 20) => new Promise(r => setTimeout(r, ms))

/** Import a bundle and report a module-body throw instead of crashing the suite. */
const importOrReport = async specifier => {
  try {
    await import(specifier)
    return null
  } catch (err) {
    return err && err.message ? err.message : String(err)
  }
}

// ---------- the JSX demo page ----------
const pageError = await importOrReport('./boot-page.bundle.mjs')
ok(
  pageError === null,
  `BOOT-1 the JSX demo page module body runs without throwing${pageError ? ` — ${pageError}` : ''}`,
)
await tick(30) // the page restores its graph from a `setTimeout`

// ---------- the vanilla demo ----------
// Its module body ends in `bootVanillaDemo()`, which queries the document; happy-dom's querySelector
// cannot walk the tree the JSX page above left behind (see the header). The host wiring it performs
// is asserted below through the very same entry point it calls, `startVanillaDemo`.
const shell = document.createElement('jsx6-nodditor')
shell.className = 'NodeEditor'
document.body.appendChild(shell)
let wiringError = null
try {
  startVanillaDemo(shell, { persist: false })
} catch (err) {
  wiringError = err
}
ok(
  wiringError === null,
  `BOOT-2 startVanillaDemo wires a host without throwing${wiringError ? ` — ${wiringError}` : ''}`,
)
ok(shell instanceof NodeEditor, 'BOOT-2 the shell is the editor custom element')
ok(shell.blocks.length > 0, `BOOT-2 the vanilla demo loaded its graph (${shell.blocks.length} blocks)`)
ok(
  shell.blocks.every(b => b.connectorMap.size > 0),
  'BOOT-2 every block has its connectors discovered',
)
ok(shell.lines.length > 0, `BOOT-2 the vanilla demo restored its lines (${shell.lines.length})`)
shell.destroy()

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL SMOKE ASSERTIONS PASSED')
process.exitCode = failures ? 1 : 0
