# Zoom controls

`jsx6-nodditor` renders its own zoom controls in the bottom-right corner of the editor, in an
**unscaled** layer (they do not shrink or grow with the content). They are the "-", a percentage
readout that resets to 100%, and "+".

Every sample on this page is injected from a real file by
[`@hrg/inject-examples`](https://github.com/hrgdavor/inject-examples) (`bun run docs:inject`), so
none of it can drift from the code that runs — the markup comes from `src/NodeEditor.jsx`, the
default styling from `static/NodeEditor.css`, and the usage sample from
[zoom-controls.example.js](./zoom-controls.example.js), which is executed by
`node doc/zoom-controls.run.mjs`.

## The controls

[../src/NodeEditor.jsx](../src/NodeEditor.jsx#region:zoom-markup)

```jsx
    this.zoomUI = (
      <div
        class="ne-zoom-ui"
        style="position:absolute;right:6px;bottom:6px;z-index:var(--ne-zoom-z,1);pointer-events:auto"
      >
        <div class="ne-zoom-bt" title="Zoom out" onclick={() => this.zoomTo(this.zoom / 1.25)}>
          −
        </div>
        <div class="ne-zoom-bt ne-zoom-val" title="Reset zoom to 100%" onclick={() => this.zoomTo(1)}></div>
        <div class="ne-zoom-bt" title="Zoom in" onclick={() => this.zoomTo(this.zoom * 1.25)}>
          +
        </div>
      </div>
    )
```

| control | class | does |
| --- | --- | --- |
| − | `.ne-zoom-bt` (first) | `zoomTo(zoom / 1.25)` — one step out |
| readout | `.ne-zoom-bt.ne-zoom-val` | shows the level; clicking it resets to 100% (`zoomTo(1)`) |
| + | `.ne-zoom-bt` (last) | `zoomTo(zoom * 1.25)` — one step in |

A step is always **×1.25 / ÷1.25**, and `zoomTo` clamps through `clampZoom`, so the buttons cannot
leave the `zoomMin`…`zoomMax` range.

At a limit the control that cannot do anything is dimmed *and* made inert by
`.ne-zoom-ui.at-min` / `.at-max` (see the stylesheet below) — the class is applied by
`updateZoomUI()` on every zoom change.

### Why `position`, `z-index` and `pointer-events` are inline

The controls are inserted **before** the canvas, and the canvas is a full-size `position: absolute`
layer. With the default `z-index: auto` the canvas paints on top of them, so the buttons were visible
but swallowed every click. The editor therefore carries its own stacking position instead of relying
on the host loading a stylesheet: a host that forgets the CSS still gets working controls.

* `z-index: var(--ne-zoom-z, 1)` — above the canvas (`contentArea`, which is `z-index: 0`).
  A host that renders its own overlay *inside* the editor can raise or lower this with
  `--ne-zoom-z` without touching the package.
* `pointer-events: auto` — a guard against a host that sets `pointer-events: none` on the editor's
  children.

`smoke/seam.smoke.jsx` asserts both, plus that each button actually moves `editor.zoom`, because
"the markup exists" is exactly the state the broken version was in.

## Default styling

The package ships **no CSS of its own** (see [../README.md](../README.md#styling)); these rules live
in `static/NodeEditor.css` and the host links that file. Every value below is the default — override
any of them in your own stylesheet, which is loaded after this one.

[../static/NodeEditor.css](../static/NodeEditor.css#region:zoom-css)

```css
/* zoom indicator + controls (bottom-right corner of the editor)
 *
 * `position`, `right`, `bottom`, `z-index` and `pointer-events` are set INLINE by the editor
 * (src/NodeEditor.jsx) because the controls sit under the canvas layer in DOM order and must stay
 * clickable even when a host does not load this stylesheet. Only the look lives here.
 * Override the stacking with `--ne-zoom-z` if a host renders something above them.
 */
.ne-zoom-ui {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  background: #fff;
  border: solid 1px #ddd;
  border-radius: 6px;
  box-shadow: 1px 1px 3px #ccc;
  user-select: none;
  color: #555;
  font-size: 13px;
}
.ne-zoom-ui .ne-zoom-bt {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f4f4f4;
}
.ne-zoom-ui .ne-zoom-bt:hover {
  background: #e8e8e8;
}
.ne-zoom-ui .ne-zoom-val {
  min-width: 42px;
  text-align: center;
}
.ne-zoom-ui.at-min .ne-zoom-bt:first-child,
.ne-zoom-ui.at-max .ne-zoom-bt:last-child {
  opacity: 0.35;
  pointer-events: none;
}
```

| property | default | notes |
| --- | --- | --- |
| position | `absolute`, `right: 6px`, `bottom: 6px` | inline; relative to the editor element |
| `z-index` | `1` | inline; `--ne-zoom-z` overrides it |
| `pointer-events` | `auto` | inline |
| `background` | `#fff` | |
| `border` / `border-radius` | `solid 1px #ddd` / `6px` | |
| `box-shadow` | `1px 1px 3px #ccc` | |
| `gap` / `padding` | `3px` / `3px` | |
| `color` / `font-size` | `#555` / `13px` | |
| `.ne-zoom-bt` background | `#f4f4f4`, hover `#e8e8e8` | |
| `.ne-zoom-val` | `min-width: 42px`, centered | keeps the readout from resizing as the level changes |
| `.at-min` / `.at-max` | `opacity: .35`, `pointer-events: none` | the dimmed, inert end control |

## What controls the levels

`zoomMin` / `zoomMax` are editor options (tpl options or properties), and they bound the API as well
as the buttons:

[../src/NodeEditor.jsx](../src/NodeEditor.jsx#region:zoom-defaults)

```js
  /**
   * @param {Object} [param]
   * @param {Function} [param.menu] menu generator, receives the selected blocks (see `menuGenerator`)
   * @param {number} [param.zoomMin] minimum zoom, default 0.3
   * @param {number} [param.zoomMax] maximum zoom, default 4 (zoom beyond 100% is allowed)
   * @param {number} [param.snap] grid size to snap block moves to, 0 = no snapping
   * @param {number} [param.nudgeStep] arrow-key nudge step in content units, Shift multiplies by 5
   * @param {Object<string, Function>} [param.typeMap] block factories, used by `loadGraph` and undo/redo
   */
  tpl({ menu = null, zoomMin = 0.3, zoomMax = 4, snap = 0, nudgeStep = 10, typeMap = null, ...attr } = {}) {
```

* `zoomMin = 0.3` — 30%; `zoomMax = 4` — 400%.
* Zoom above 100% is allowed, so `zoomMax` is the only upper bound.
* The readout shows `Math.round(zoom * 100) + '%'`.

## Using the controls (host view)

[zoom-controls.example.js](./zoom-controls.example.js#region:demo)

```js
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
```

## Building your own controls

The built-in controls are just calls into the public zoom API, so a host can hide them (or never
show them) and drive the editor itself:

| method | does |
| --- | --- |
| `zoom` (getter) | current level, `1` = 100% |
| `zoomTo(level)` | absolute level, clamped to `zoomMin`/`zoomMax`, centered on the editor |
| `changeZoom(delta, x, y)` | relative change anchored at a point in editor coordinates |
| `changeZoomMouse(delta, e)` | relative change anchored at the pointer — what the demo wires to `wheel` |
| `changeZoomCenter(delta)` | relative change anchored at the editor's middle |
| `clampZoom(level)` | the clamp on its own |
| `resetView(padx, pady)` | fit the graph into view and reset positions (not a zoom reset — it *keeps* the level) |

External zoom entry points are the host's choice; the demo page binds the wheel
(`onwheel → changeZoomMouse`) and the editor itself handles `Ctrl`/`Cmd` with `+`, `-`, `_`, `=` and
`0` (100%).

## Where the controls live in the DOM

```
<jsx6-nodditor class="NodeEditor">        ← position: relative (stylesheet)
  <div class="ne-zoom-ui">                ← inline absolute, z-index 1
  <div class="ne-sr-status">              ← inline-hidden aria-live region
  <div style="position:absolute; … z-index:0">   ← contentArea: the pannable/zoomable canvas
    <svg>…</svg>                          ← line layer (pointer-events: none)
    …blocks…
  </div>
</jsx6-nodditor>
```

The order matters and is why the stacking is explicit: the controls come first for historical
reasons (they are inserted before the canvas is built), so the canvas has to be kept *below* them
rather than the other way round.
