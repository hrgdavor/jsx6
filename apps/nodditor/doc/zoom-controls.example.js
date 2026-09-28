/**
 * Runnable example: the built-in zoom controls.
 *
 * The `demo` region is what `doc/zoom-controls.md` injects; everything outside it is the check that
 * keeps the sample honest. Run it from the app root (it needs the DOM):
 *
 *   cd apps/nodditor
 *   node doc/zoom-controls.run.mjs
 *
 * The suite is named `*.example.js` (not `*.test.jsx`) on purpose: it needs happy-dom globals
 * registered before the editor module is evaluated, which the runner does.
 */
import assert from 'node:assert/strict'

import { NodeEditor } from '../src/NodeEditor.jsx'

const host = new NodeEditor({ menu: () => null, zoomMin: 0.3, zoomMax: 4 })
host.className = 'NodeEditor'
document.body.appendChild(host)

// #region demo
const zoomUI = host.querySelector('.ne-zoom-ui')
const [zoomOut, zoomReset, zoomIn] = zoomUI.querySelectorAll('.ne-zoom-bt')

// The controls live in the bottom-right corner of the editor. `position`, `z-index` and
// `pointer-events` come from the editor itself, because the canvas layer is inserted after them:
// with the default `z-index: auto` the canvas would paint over the buttons and they would be
// visible but unclickable.
assert.equal(getComputedStyle(zoomUI).zIndex, '1')
assert.equal(getComputedStyle(zoomUI).pointerEvents, 'auto')
assert.ok(
  Number(getComputedStyle(zoomUI).zIndex) > Number(getComputedStyle(host.contentArea).zIndex),
  'the controls must stack above the canvas',
)

assert.equal(host.zoom, 1)
zoomIn.dispatchEvent(new MouseEvent('click', { bubbles: true })) // ×1.25
assert.equal(host.zoom, 1.25)
zoomOut.dispatchEvent(new MouseEvent('click', { bubbles: true })) // ÷1.25
assert.equal(host.zoom, 1)
host.changeZoom(0.5)
zoomReset.dispatchEvent(new MouseEvent('click', { bubbles: true })) // back to 100%
assert.equal(host.zoom, 1)
// #endregion demo

// The readout is the middle button and follows every zoom change, not just the buttons' own.
assert.equal(host.querySelector('.ne-zoom-val').textContent, '100%')
host.changeZoom(0.25)
assert.equal(host.querySelector('.ne-zoom-val').textContent, '125%')

// Clamping is the host's contract: `zoomMin`/`zoomMax` bound both the buttons and the API.
host.zoomTo(99)
assert.equal(host.zoom, 4)
host.zoomTo(0.01)
assert.equal(host.zoom, 0.3)

// At the limits the control that cannot do anything is dimmed and made inert (`.at-min`/`.at-max`).
const ui = host.querySelector('.ne-zoom-ui')
assert.ok(ui.classList.contains('at-min'), 'at the minimum, the zoom-out control is marked inert')
host.zoomTo(4)
assert.ok(ui.classList.contains('at-max'), 'at the maximum, the zoom-in control is marked inert')

// A host may move the controls to another layer with `--ne-zoom-z`; it still overrides the default.
host.style.setProperty('--ne-zoom-z', '5')
assert.equal(getComputedStyle(zoomUI).zIndex, '5')

// The editor hands the API out as well, so a host can build its own controls (see the doc).
assert.equal(typeof host.changeZoomMouse, 'function')
assert.equal(typeof host.resetView, 'function')

host.destroy()
console.log('zoom-controls example: all assertions passed')
