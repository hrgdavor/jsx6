/**
 * Line-layer tests for nodditor, driven through the real editor under happy-dom.
 *
 * Covered:
 *  - the default SVG line layer: parity with the pre-refactor behaviour (lines live in
 *    `editor.svgLayer`, selection states land as classes on the line `<g>`)
 *  - the optional WebGPU canvas line layer (`makeCanvasLineLayer`): DOM wiring, edge
 *    building and rendering with the real `@jsx6/line-render` `parseLinePath` (pure
 *    math), picking with the real `pickEdge`, viewport/resize flow, add/remove flow
 *    through the editor API, and the degraded path when renderer `init()` rejects
 *  - `editor.setLineLayer`: canvas ↔ SVG swaps, same-layer and post-destroy no-ops
 *
 * happy-dom has no WebGPU, so the canvas layer is tested with a fake `LineRenderer`
 * (recorded draw calls, `init()` succeeding or rejecting on demand) around the REAL
 * `parseLinePath`/`pickEdge`. The `loadLineRender` null-fallback path is the same
 * contract in the real world (unresolvable import → warn → keep the SVG layer).
 */
import './setup.js'

import { afterEach, beforeEach, expect, test } from 'bun:test'

import { NodeEditor } from '../src/NodeEditor.jsx'
import { ConnectLine } from '../src/ConnectLine.js'
import { Message } from '../src/blocks/Message.js'
import { Switch } from '../src/blocks/Switch.js'
import { createSvgLineLayer } from '../src/lineLayer.js'
import { installCanvasLineLayer, makeCanvasLineLayer } from '../src/canvasLineLayer.js'
import { edgeToPath, parseLinePath, pickEdge, polylineBounds as lrPolylineBounds } from '@jsx6/line-render'

const typeMap = { Switch: () => <Switch />, Message: () => <Message /> }

/** @type {NodeEditor} */
let editor
/** @type {ReturnType<typeof makeMenu>} */
let menu

function makeMenu() {
  const el = <div class="ne-menu"></div>
  return { el, generator: () => el }
}

beforeEach(() => {
  menu = makeMenu()
  editor = new NodeEditor({ menu: menu.generator, typeMap })
  document.body.appendChild(editor)
})

afterEach(() => {
  editor.destroy()
  editor.remove()
  document.body.innerHTML = ''
})

function addTwoBlocks() {
  const b1 = editor.add(<Switch />, '1', { pos: [30, 10], type: 'Switch' })
  const b2 = editor.add(<Switch />, '2', { pos: [30, 210], type: 'Switch' })
  return { b1, b2 }
}

/** Flush the canvas layer's rAF-batched redraw (happy-dom's rAF is a timer under the hood). */
const waitFrame = () => new Promise(r => setTimeout(r, 50))

/**
 * A point `d` CSS px off the line's midpoint, PERPENDICULAR to the curve there — the
 * only offset that measures the pick band (a connector's midpoint tangent is vertical, so
 * offsetting in y would slide along the line).
 */
function offsetFromMidpoint(line, d) {
  const p = line.samplePoints()
  // flat index of the middle vertex's x; its y is the next number
  const mid = Math.floor(p.length / 4) * 2
  const dx = p[mid + 2] - p[mid - 2]
  const dy = p[mid + 3] - p[mid - 1]
  const len = Math.hypot(dx, dy) || 1
  return [p[mid] + (-dy / len) * d, p[mid + 1] + (dx / len) * d]
}

/**
 * A fake `@jsx6/line-render` module: the REAL `parseLinePath`/`pickEdge` (pure curve
 * math) plus a `LineRenderer` whose `init()` succeeds, rejects or WAITS on demand and
 * whose `render`/`setViewport`/`dispose` calls are recorded.
 *
 * `initGate` is a promise the fake `init()` awaits — or a FUNCTION returning one, which is
 * how a per-life gate is built (each `init()` call takes the next one) — so a test can
 * dispose and revive the layer while the GPU is still coming up. `supported` drives the
 * static `isSupported()` probe; `created` collects the constructor options of every
 * renderer built (which is how the device forwarding is asserted); `renderers` records the
 * instance behind each `render()` call (so a test can prove WHICH life is drawing);
 * `lostHook` is the `onLost` the layer passed in. `create()` mirrors the library contract:
 * null instead of a throw.
 */
function fakeLr({ initReject = false, initGate = null, supported = true } = {}) {
  const rendered = []
  const viewports = []
  /** @type {any[]} constructor options of every renderer that was built */
  const created = []
  /** @type {LineRenderer[]} the instance behind every `render()` call */
  const renderers = []
  let instances = 0
  let disposedCount = 0
  let lostHook = null
  class LineRenderer {
    static isSupported() {
      return supported
    }
    static async create(canvas, opts) {
      const r = new LineRenderer(canvas, opts)
      try {
        await r.init()
      } catch {
        r.dispose()
        return null
      }
      return r
    }
    constructor(canvas, opts) {
      this.id = ++instances
      this.canvas = canvas
      this.opts = opts
      created.push(opts)
      lostHook = opts?.onLost
    }
    async init() {
      if (initGate) await (typeof initGate == 'function' ? initGate() : initGate)
      if (initReject) throw new Error('no gpu')
    }
    setViewport(x, y, z) {
      viewports.push([x, y, z])
    }
    render(edges) {
      rendered.push(edges)
      renderers.push(this)
    }
    dispose() {
      disposedCount++
    }
  }
  return {
    parseLinePath,
    pickEdge,
    LineRenderer,
    rendered,
    viewports,
    created,
    renderers,
    get disposedCount() {
      return disposedCount
    },
    /** Report a device loss through the callback the layer handed to the renderer. */
    lose: info => lostHook?.(info),
  }
}

/** The curve point at t = 1/2 — exactly on the parsed edge, in world coordinates. */
function curveMidpoint(line) {
  const e = parseLinePath(line.d)
  return [(e.x0 + 3 * e.cx0 + 3 * e.cx1 + e.x1) / 8, (e.y0 + 3 * e.cy0 + 3 * e.cy1 + e.y1) / 8]
}

// ---------- the default SVG layer ----------

test('the default line layer is the SVG layer and lines live in the svg element', () => {
  expect(editor.lineLayer.kind).toBe('svg')
  expect(editor.lineLayer.el).toBe(editor.svgLayer)

  addTwoBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')
  expect(line.el.parentNode).toBe(editor.svgLayer)
  expect(line.d).toMatch(/^M[-\d.]+ [-\d.]+ C[-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+$/)
})

test('svg layer: selection states land as classes on the line <g>', () => {
  const { b1, b2 } = addTwoBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')

  editor.selectConnector(line)
  expect(line.el.classList.contains('selected')).toBe(true)
  editor.selectConnector(null)
  expect(line.el.classList.contains('selected')).toBe(false)

  editor.selectBlocks([b2])
  expect(line.el.classList.contains('ne-to-sel-block')).toBe(true)
  editor.selectBlocks([b1])
  expect(line.el.classList.contains('ne-from-sel-block')).toBe(true)
  expect(line.el.classList.contains('ne-to-sel-block')).toBe(false)
  editor.selectBlocks([])
  expect(line.el.classList.contains('ne-from-sel-block')).toBe(false)
  expect(line.el.classList.contains('ne-to-sel-block')).toBe(false)
})

test('svg layer: it renders the line cached shape text into both paths', () => {
  addTwoBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')

  // the shape lives on the line as data; the layer put the cached text into the DOM
  expect(line.edge).not.toBeNull()
  expect(line.line1.getAttribute('d')).toBe(line.pathText)
  expect(line.line2.getAttribute('d')).toBe(line.pathText)
  expect(line.pathText).toBe(line.d) // `d` is the historical alias

  // a move re-applies the text through the layer's subscription (the line never
  // touches the DOM itself)
  const before = line.line1.getAttribute('d')
  line.setPos2(300, 100)
  expect(line.line1.getAttribute('d')).toBe(line.pathText)
  expect(line.line2.getAttribute('d')).toBe(line.pathText)
  expect(line.line1.getAttribute('d')).not.toBe(before)
})

test('svg layer: swapping layers releases the text subscription it owned', () => {
  addTwoBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')
  expect(line.pathListeners.length).toBe(1) // the svg layer follows the shape

  // `setLineLayer` takes the lines off the old layer without finalizing them: the
  // old layer's subscription must go, or it keeps writing into a detached element
  editor.setLineLayer(createSvgLineLayer(editor))
  expect(line.pathListeners.length).toBe(1) // ... and the new one took over
  line.setPos2(300, 100)
  expect(line.line1.getAttribute('d')).toBe(line.pathText)
})

// ---------- the connector's shape caches ----------

test('a line keeps its shape as data and rebuilds the derived caches per change', () => {
  addTwoBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')
  /** the 8 geometry numbers, so the comparison ignores line-render's extra Edge fields */
  const geom = e => [e.x0, e.y0, e.cx0, e.cy0, e.cx1, e.cy1, e.x1, e.y1]

  // the numeric edge is the source of truth, and the SVG text is its data form
  expect(geom(line.edge)).toEqual(geom(parseLinePath(line.pathText)))
  expect(line.changeId).toBeGreaterThan(0)

  const points = line.samplePoints()
  expect(points).toBeInstanceOf(Float64Array)
  expect(line.pointsBox).toEqual(lrPolylineBounds(points))
  expect(line.samplePoints()).toBe(points) // cached: no rebuild without a change

  // a change drops the caches and stamps a NEW id
  const changeId = line.changeId
  const box = line.pointsBox
  line.setPos2(300, 100)
  expect(line.changeId).toBeGreaterThan(changeId)
  expect(line.points).not.toBe(points) // rebuilt for the new shape
  expect(line.pointsBox).not.toBe(box)
  expect(line.samplePoints()).toBe(line.points)
  expect(geom(line.edge)).toEqual(geom(parseLinePath(line.pathText)))
  expect(line.pointsBox).toEqual(lrPolylineBounds(line.points))
})

test('canvas layer: the shape caches follow the line without an SVG round trip', async () => {
  addTwoBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)
  await layer.ready

  // the line was created while the SVG layer was active, so its text was built then;
  // from here on nothing asks for it (the canvas layer reads the data, not the string)
  expect(typeof line.svgText).toBe('string')
  expect(line.line1.getAttribute('d')).toBe(line.svgText)

  line.setPos2(300, 100)
  // the change cleared the caches; the next frame rebuilds the POINTS (the canvas
  // layer walks line.samplePoints()) and never rebuilds the text
  expect(line.points).toBeNull()
  expect(line.svgText).toBeNull()
  await waitFrame()
  expect(line.svgText).toBeNull()
  expect(line.points).not.toBeNull()
  expect(fx.rendered.at(-1)[0].x1).toBe(300)
  expect(fx.rendered.at(-1)[0].points).toBe(line.points)
  expect(fx.rendered.at(-1)[0].pointsBox).toBe(line.pointsBox)

  // picking walks the cached polyline and converts the POINTER into world space, so
  // moving the viewport must not rebuild it
  const points = line.points
  editor.zoom = 2
  layer.pick(300, 100)
  expect(line.points).toBe(points)
})

// ---------- the canvas layer ----------

test('canvas layer: canvas sits under .ne-canvas, edges render with their state colors', async () => {
  const { b1, b2 } = addTwoBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)
  await layer.ready

  expect(editor.lineLayer).toBe(layer)
  expect(layer.kind).toBe('canvas')
  expect(layer.el.classList.contains('ne-canvas-line-layer')).toBe(true)
  // below `.ne-canvas` in DOM order: inserted before `editor.contentArea` (the `.ne-canvas` element)
  const children = [...editor.childNodes]
  expect(children.indexOf(layer.el)).toBeLessThan(children.indexOf(editor.contentArea))

  await waitFrame()
  expect(fx.rendered.length).toBeGreaterThanOrEqual(1)
  const edges = fx.rendered.at(-1)
  expect(edges.length).toBe(1)
  const edge = edges[0]
  expect(edge.line).toBe(line)
  expect(edge.color).toEqual([0, 0, 0, 1]) // base black
  expect(edge.width).toBe(2) // 2 CSS px × devicePixelRatio(1)

  editor.selectConnector(line)
  await waitFrame()
  expect(fx.rendered.at(-1)[0].color).toEqual([46 / 255, 167 / 255, 167 / 255, 1]) // g.selected
  editor.selectBlocks([b2])
  await waitFrame()
  expect(fx.rendered.at(-1)[0].color).toEqual([46 / 255, 108 / 255, 167 / 255, 1]) // ne-to-sel-block
  editor.selectBlocks([b1, b2])
  await waitFrame()
  // from and to at once: to-sel wins, mirroring the stylesheet rule order
  expect(fx.rendered.at(-1)[0].color).toEqual([46 / 255, 108 / 255, 167 / 255, 1])
})

test('canvas layer: pick uses the real pickEdge and works before the GPU is ready', async () => {
  addTwoBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)
  // do NOT await `layer.ready`: edges are built lazily on first pick
  const [px, py] = curveMidpoint(line)
  expect(layer.pick(px, py)).toBe(line)
  expect(layer.pick(px + 1000, py + 1000)).toBeNull()
})

test('canvas layer: zoom and resize flow through to the renderer and the canvas', async () => {
  addTwoBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)
  await layer.ready
  await waitFrame()
  viewportsReset(fx)

  layer.onResize(400, 300)
  expect(layer.el.width).toBe(400)
  expect(layer.el.height).toBe(300)

  editor.zoom = 2
  expect(fx.viewports.at(-1)).toEqual([0, 0, 2]) // (0, 0, zoom × dpr)

  // `realWidth`/`realHeight` are undefined until the ResizeObserver fires: no NaN
  const fx2 = fakeLr()
  const layer2 = makeCanvasLineLayer(editor, fx2)
  editor.setLineLayer(layer2)
  expect(layer2.el.width).toBeGreaterThanOrEqual(1)
})

test('canvas layer: addConnectorFromTo and removeLine flow through the layer', async () => {
  const { b1, b2 } = addTwoBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')
  const b3 = editor.add(<Message />, '3', { pos: [230, 110], type: 'Message' })

  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)
  await layer.ready
  await waitFrame()
  expect(fx.rendered.at(-1).length).toBe(1)

  const line2 = editor.addConnectorFromTo('1/o2', '3/i1')
  await waitFrame()
  expect(fx.rendered.at(-1).length).toBe(2)

  editor.removeLine(line2)
  await waitFrame()
  expect(fx.rendered.at(-1).length).toBe(1)
})

test('canvas layer: a line being connected (free end) is drawn and tracks the pointer', async () => {
  addTwoBlocks()
  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)
  await layer.ready

  // Mirror `LineInteraction.newConnector`'s drag start: a fresh line, one end
  // attached, the free end a raw pointer position (`p2.con` stays null)
  const line = editor.addConnector(new ConnectLine())
  editor.selectConnector(line)
  line.setPoint1(editor.getConnector('1', 'o1'))
  line.setPos2(300, 100)
  await waitFrame()

  // The in-progress connector is drawn (previously `buildEdges` skipped lines
  // without BOTH connectors) in the selected colour the drag applies
  expect(fx.rendered.at(-1).length).toBe(1)
  const edge = fx.rendered.at(-1)[0]
  expect(edge.line).toBe(line)
  expect(edge.color).toEqual([46 / 255, 167 / 255, 167 / 255, 1])
  expect([edge.x1, edge.y1]).toEqual([300, 100]) // curve endpoint = free-end position

  // Moving the free end fires no `ne-move` event: the redraw must come from
  // the `onPathChange` listener
  line.setPos2(300, 200)
  await waitFrame()
  expect(fx.rendered.at(-1)[0].y1).toBe(200)

  // A failed drag removes the line; it drops out of the next frame
  editor.removeLine(line)
  await waitFrame()
  expect(fx.rendered.at(-1).length).toBe(0)
})

test('canvas layer: a failed init rejects `ready`, picking still works, dispose is quiet', async () => {
  addTwoBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr({ initReject: true })
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)

  // `LineRenderer.create()` reported the cause to the console and resolved null,
  // so the layer reports the degradation without an exception
  await expect(layer.ready).rejects.toThrow(/could not be started/)
  // the canvas stays blank, but pick is pure curve math and still works
  const [px, py] = curveMidpoint(line)
  expect(layer.pick(px, py)).toBe(line)

  layer.dispose()
  expect(layer.el.parentNode).toBeNull()
  expect(() => layer.dispose()).not.toThrow()
})

test('canvas layer: no WebGPU is caught by the synchronous probe, before any renderer', async () => {
  addTwoBlocks()
  const fx = fakeLr({ supported: false })
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)

  await expect(layer.ready).rejects.toThrow(/WebGPU is not available/)
  expect(fx.created.length).toBe(0) // nothing was constructed, no adapter asked for
  layer.dispose()
})

test('canvas layer: a host device is forwarded to the renderer (shared device)', async () => {
  addTwoBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')

  const shared = { fake: 'GPUDevice' }
  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx, { device: shared })
  editor.setLineLayer(layer)
  await layer.ready
  await waitFrame()

  expect(fx.created.length).toBe(1)
  expect(fx.created[0].device).toBe(shared)
  expect(fx.rendered.at(-1).length).toBe(1) // and it draws normally
  layer.dispose()
})

test('canvas layer: edges keep the SVG layer screen-pixel width (worldWidth: false)', async () => {
  addTwoBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)
  await layer.ready
  await waitFrame()

  // The layer's stroke policy is a constant 2 CSS px at any zoom (mirroring the 8px
  // non-scaling CSS hit stroke the pick radius is derived from), so the canvas edge
  // must opt OUT of the world-unit width. `parseLinePath` used to drop the flag,
  // which silently turned these edges into zoom-scaled ones.
  expect(fx.rendered.at(-1)[0].worldWidth).toBe(false)

  editor.zoom = 4
  await waitFrame()
  const zoomed = fx.rendered.at(-1)[0]
  expect(zoomed.worldWidth).toBe(false)
  expect(zoomed.width).toBe(2) // screen px, unchanged by the zoom
})

// ---------- canvas layer: GPU lifetime ----------

test('canvas layer: dispose during GPU init settles `ready` and releases the renderer', async () => {
  addTwoBlocks()
  let release
  const gate = new Promise(resolve => (release = resolve))
  const fx = fakeLr({ initGate: gate })

  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)
  layer.dispose() // the adapter/device is still being acquired
  release()

  // a host awaiting `ready` must not hang on a layer that is gone
  await expect(layer.ready).rejects.toThrow(/disposed/)
  await waitFrame()
  expect(fx.disposedCount).toBe(1) // the renderer created during the race is released
  expect(fx.rendered.length).toBe(0) // and never draws into the removed canvas
  expect(layer.el.parentNode).toBeNull()
})

test('canvas layer: a lost device stops drawing, releases the renderer and notifies the host', async () => {
  addTwoBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  const lost = []
  const layer = makeCanvasLineLayer(editor, fx, { onLost: info => lost.push(info) })
  editor.setLineLayer(layer)
  await layer.ready
  await waitFrame()
  const frames = fx.rendered.length

  fx.lose({ reason: 'destroyed', message: 'gpu reset' })
  await waitFrame()
  expect(lost.length).toBe(1)
  expect(fx.disposedCount).toBe(1)
  expect(fx.rendered.length).toBe(frames) // the redraw loop stopped

  // picking is pure curve math: it keeps working on a dead GPU, including for a
  // line added after the loss (nothing redraws, so the list is rebuilt on demand)
  const line = editor.lines[0]
  const [px, py] = curveMidpoint(line)
  expect(layer.pick(px, py)).toBe(line)
  editor.add(<Message />, '3', { pos: [230, 110], type: 'Message' })
  const line2 = editor.addConnectorFromTo('1/o2', '3/i1')
  const [px2, py2] = curveMidpoint(line2)
  expect(layer.pick(px2, py2)).toBe(line2)

  // a second loss (or a later frame) must not report again or draw again
  fx.lose({ reason: 'destroyed', message: 'gpu reset' })
  editor.zoom = 2
  await waitFrame()
  expect(lost.length).toBe(1)
  expect(fx.rendered.length).toBe(frames)
})

test('canvas layer: a throwing renderer is treated as a loss', async () => {
  addTwoBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  const lost = []
  const layer = makeCanvasLineLayer(editor, fx, { onLost: info => lost.push(info) })
  editor.setLineLayer(layer)
  await layer.ready
  await waitFrame()

  const realRender = fx.LineRenderer.prototype.render
  fx.LineRenderer.prototype.render = () => {
    throw new Error('device is gone')
  }
  editor.zoom = 2 // schedule a frame
  await waitFrame()
  expect(lost.length).toBe(1)
  expect(lost[0]).toBeInstanceOf(Error)
  expect(fx.disposedCount).toBe(1)

  fx.LineRenderer.prototype.render = realRender
})

test('canvas layer: a device pixel ratio change resizes the backing store and the viewport', async () => {
  addTwoBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  // capture the MediaQueryList the layer watches for the ratio change
  const realMatchMedia = window.matchMedia.bind(window)
  /** @type {any} */
  let query = null
  window.matchMedia = q => (query = realMatchMedia(q))
  try {
    const layer = makeCanvasLineLayer(editor, fx)
    editor.setLineLayer(layer)
    await layer.ready
    layer.onResize(400, 300)
    expect(layer.el.width).toBe(400)

    // a 2x display: the backing store follows the ratio, and so must the viewport
    window.devicePixelRatio = 2
    query.dispatchEvent(new Event('change'))
    expect(layer.el.width).toBe(800)
    expect(layer.el.height).toBe(600)
    expect(fx.viewports.at(-1)).toEqual([0, 0, 2]) // zoom 1 × dpr 2

    // the pick scale follows too: client coordinates are CSS px, so the click
    // position is unchanged — only the backing-store math behind it scales
    const line = editor.lines[0]
    const [px, py] = curveMidpoint(line)
    expect(layer.pick(px, py)).toBe(line)

    layer.dispose()
    expect(fx.disposedCount).toBe(1)
  } finally {
    window.matchMedia = realMatchMedia
    window.devicePixelRatio = 1
  }
})

// ---------- disposal and revival ----------

test('canvas layer: revive on a live layer is a no-op', async () => {
  addTwoBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)
  await layer.ready
  await waitFrame()
  const firstReady = layer.ready
  const frames = fx.rendered.length

  layer.revive()
  expect(layer.disposed).toBe(false)
  expect(layer.ready).toBe(firstReady) // same life, same promise
  expect(fx.created.length).toBe(1) // and no second GPU session
  await waitFrame()
  expect(fx.rendered.length).toBe(frames) // nothing was rescheduled
  layer.dispose()
})

test('canvas layer: a disposed layer is revived by re-installing it', async () => {
  addTwoBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)
  await layer.ready
  await waitFrame()
  const firstReady = layer.ready

  // swap to SVG: `setLineLayer` disposes the canvas layer on the way out
  editor.setLineLayer(createSvgLineLayer(editor))
  expect(layer.disposed).toBe(true)
  expect(layer.el.parentNode).toBeNull()
  // the ready of a life that never settled is aborted; this one had RESOLVED, so it
  // stays resolved — only the next life gets a new promise (asserted below)
  await expect(firstReady).resolves.toBeUndefined()

  // hand the SAME layer back: `onViewport` revives it
  editor.setLineLayer(layer)
  expect(layer.disposed).toBe(false)
  expect(layer.ready).not.toBe(firstReady) // a fresh life gets a fresh promise
  await layer.ready
  await waitFrame()

  // back where it belongs, on a NEW GPU session, drawing against the live lines
  const kids = [...editor.childNodes]
  expect(kids.indexOf(layer.el)).toBeLessThan(kids.indexOf(editor.contentArea))
  expect(fx.created.length).toBe(2)
  expect(fx.renderers.at(-1).id).toBe(2)
  expect(fx.rendered.at(-1).length).toBe(1)
  // revive registered the editor's lines itself (the editor re-adds them too, idempotently)
  expect(line.pathListeners.length).toBe(1)
  const [px, py] = curveMidpoint(line)
  expect(layer.pick(px, py)).toBe(line)
})

test('canvas layer: setLineLayer on the ACTIVE disposed layer revives it in place', async () => {
  addTwoBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)
  await layer.ready
  await waitFrame()

  // a host that disposes the layer the editor is still using
  layer.dispose()
  expect(layer.disposed).toBe(true)
  expect(layer.el.parentNode).toBeNull()

  editor.setLineLayer(layer) // same-layer call: revive instead of a silent no-op
  expect(layer.disposed).toBe(false)
  await layer.ready
  await waitFrame()
  expect(fx.created.length).toBe(2)
  expect(fx.rendered.at(-1).length).toBe(1)
  // the editor did NOT re-add the lines on this path, so revive must have
  expect(line.pathListeners.length).toBe(1)
  // ... and re-adding them anyway must not double-subscribe
  layer.add(line)
  layer.add(line)
  expect(line.pathListeners.length).toBe(1)

  const [px, py] = curveMidpoint(line)
  expect(layer.pick(px, py)).toBe(line)
})

test('canvas layer: a GPU startup from a disposed life never publishes over the new one', async () => {
  addTwoBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')

  /** @type {Array<() => void>} one resolver per `init()` call */
  const gates = []
  const fx = fakeLr({ initGate: () => new Promise(resolve => gates.push(resolve)) })
  const layer = makeCanvasLineLayer(editor, fx) // life 0 — waits on gates[0]
  editor.setLineLayer(layer)
  const firstReady = layer.ready
  expect(gates.length).toBe(1)

  layer.dispose() // disposed while the GPU was still starting
  await expect(firstReady).rejects.toThrow(/disposed/)
  layer.revive() // life 2 — waits on gates[1]
  expect(gates.length).toBe(2)

  // the OLD startup finishes: it must release its device and never publish
  gates[0]()
  await waitFrame()
  expect(fx.disposedCount).toBe(1)
  expect(fx.rendered.length).toBe(0)
  expect(layer.disposed).toBe(false) // and must not disturb the current life

  // the current startup finishes: THIS one draws
  gates[1]()
  await layer.ready
  await waitFrame()
  expect(fx.created.length).toBe(2)
  expect(fx.renderers.at(-1).id).toBe(2)
  expect(fx.rendered.length).toBeGreaterThan(0)

  // ... and a frame from the old life cannot draw either (the counter is checked)
  expect(fx.renderers.filter(r => r.id === 1).length).toBe(0)
  layer.dispose()
  expect(fx.disposedCount).toBe(2) // the live session is releasable
})

test('canvas layer: revive does nothing on a destroyed editor', async () => {
  addTwoBlocks()
  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)
  await layer.ready

  layer.dispose()
  editor.destroy()
  layer.revive()

  // reviving here would acquire a GPU session that nothing can ever release
  expect(layer.disposed).toBe(true)
  expect(layer.el.parentNode).toBeNull()
  expect(fx.created.length).toBe(1)
})

// ---------- the line theme ----------

test('canvas layer: the stroke colours, width and pick band come from the theme', async () => {
  addTwoBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')

  // a host themes both layers by setting variables (inline here; a stylesheet rule or an
  // ancestor works in a browser, where custom properties inherit)
  editor.style.setProperty('--ne-line-color', '#102030')
  editor.style.setProperty('--ne-line-selected', 'rgb(255, 0, 0)')
  editor.style.setProperty('--ne-line-width', '3px')
  editor.style.setProperty('--ne-line-hit-width', '12px')

  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)
  await layer.ready
  await waitFrame()

  const edge = fx.rendered.at(-1)[0]
  expect(edge.color).toEqual([16 / 255, 32 / 255, 48 / 255, 1]) // --ne-line-color
  expect(edge.width).toBe(3) // --ne-line-width × devicePixelRatio

  editor.selectConnector(line)
  await waitFrame()
  expect(fx.rendered.at(-1)[0].color).toEqual([1, 0, 0, 1]) // --ne-line-selected

  // the pick band is HALF the hit width: 6 CSS px here, so 5 px off the line still hits
  // and 7 px does not (the default 4 px band would have missed both)
  expect(layer.pick(...offsetFromMidpoint(line, 5))).toBe(line)
  expect(layer.pick(...offsetFromMidpoint(line, 7))).toBeNull()
})

test('canvas layer: a theme change is picked up by the live layer', async () => {
  addTwoBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)
  await layer.ready
  await waitFrame()
  expect(fx.rendered.at(-1)[0].color).toEqual([0, 0, 0, 1]) // the default

  // The trigger is an ATTRIBUTE write on the editor: a stylesheet theme flips a class,
  // and `style.setProperty` reaches the same observer in a browser (happy-dom only
  // delivers records for `setAttribute` / `classList`, so the test writes the attribute).
  editor.setAttribute('style', '--ne-line-color: #00ff00')
  await waitFrame()
  expect(fx.rendered.at(-1)[0].color).toEqual([0, 1, 0, 1])

  // ... and the width too (the same observer re-reads the whole theme)
  editor.setAttribute('style', '--ne-line-color: #00ff00; --ne-line-width: 5px')
  await waitFrame()
  expect(fx.rendered.at(-1)[0].width).toBe(5)
})

test('canvas layer: renderer options are passed through to the renderer', async () => {
  addTwoBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx, {
    clear: [0.1, 0.2, 0.3, 0.4],
    supersample: 2,
    segmentsPerCurve: 8,
  })
  editor.setLineLayer(layer)
  await layer.ready

  expect(fx.created[0].clear).toEqual([0.1, 0.2, 0.3, 0.4])
  expect(fx.created[0].supersample).toBe(2)
  expect(fx.created[0].segmentsPerCurve).toBe(8)

  // the defaults stay transparent and plain-MSAA
  const fx2 = fakeLr()
  const layer2 = makeCanvasLineLayer(editor, fx2)
  editor.setLineLayer(layer2)
  await layer2.ready
  expect(fx2.created[0].clear).toEqual([0, 0, 0, 0])
  expect(fx2.created[0].supersample).toBe(1)
})

// ---------- installCanvasLineLayer ----------

test('installCanvasLineLayer: installs the canvas layer and reports the mode', async () => {
  addTwoBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  const { mode, layer } = await installCanvasLineLayer(editor, { lr: fx })
  expect(mode).toBe('canvas')
  expect(editor.lineLayer).toBe(layer)
  expect(layer.kind).toBe('canvas')
  await waitFrame()
  expect(fx.rendered.at(-1).length).toBe(1) // and it is drawing
})

test('installCanvasLineLayer: falls back to a working SVG layer when the renderer fails', async () => {
  addTwoBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr({ initReject: true })
  const { mode, layer, error } = await installCanvasLineLayer(editor, { lr: fx })
  expect(mode).toBe('svg')
  expect(layer).toBeNull()
  expect(error).toBeInstanceOf(Error)
  // the failed canvas layer is not left installed: the SVG layer draws again
  expect(editor.lineLayer.kind).toBe('svg')
  expect(line.el.parentNode).toBe(editor.svgLayer)
  expect(line.line1.getAttribute('d')).toBe(line.pathText)
})

test('installCanvasLineLayer: no WebGPU never builds a renderer', async () => {
  addTwoBlocks()
  const fx = fakeLr({ supported: false })
  const { mode, error } = await installCanvasLineLayer(editor, { lr: fx })
  expect(mode).toBe('svg')
  expect(error).toBeUndefined() // not a failure: the browser simply has no WebGPU
  expect(fx.created.length).toBe(0)
  expect(editor.lineLayer.kind).toBe('svg')
})

test('installCanvasLineLayer: a lost device degrades to SVG and tells the host', async () => {
  addTwoBlocks()
  editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  const lost = []
  const { mode } = await installCanvasLineLayer(editor, { lr: fx, onLost: info => lost.push(info) })
  expect(mode).toBe('canvas')

  fx.lose({ reason: 'destroyed', message: 'gpu reset' })
  await waitFrame()
  expect(editor.lineLayer.kind).toBe('svg') // the helper swapped it back for the host
  expect(lost.length).toBe(1)
})

// ---------- setLineLayer ----------

test('setLineLayer: swapping back to SVG restores the <g> lines and their states', async () => {
  const { b1, b2 } = addTwoBlocks()
  const line = editor.addConnectorFromTo('1/o1', '2/i1')

  const fx = fakeLr()
  const layer = makeCanvasLineLayer(editor, fx)
  editor.setLineLayer(layer)
  await layer.ready
  // in canvas mode the line <g> was never attached to the DOM
  expect(line.el.parentNode).toBeNull()

  editor.setLineLayer(createSvgLineLayer(editor))
  expect(editor.lineLayer.kind).toBe('svg')
  expect(layer.el.parentNode).toBeNull() // the canvas was disposed
  expect(line.el.parentNode).toBe(editor.svgLayer) // re-inserted by the svg layer

  editor.selectBlocks([b1, b2])
  expect(line.el.classList.contains('ne-from-sel-block')).toBe(true)
  expect(line.el.classList.contains('ne-to-sel-block')).toBe(true)
})

test('setLineLayer: same-layer and post-destroy calls are no-ops', () => {
  editor.setLineLayer(editor.lineLayer)
  expect(editor.lineLayer.kind).toBe('svg')

  editor.destroy()
  const fx = fakeLr()
  editor.setLineLayer(makeCanvasLineLayer(editor, fx))
  expect(editor.lineLayer.kind).toBe('svg')
})

// ---------- the line-render contract the layer relies on ----------

test('line-render: parseLinePath/edgeToPath round-trip and pickEdge picks the closest edge', () => {
  const d = 'M10 20 C70 20 130 60 190 60'
  const e1 = parseLinePath(d, { color: [1, 0, 0, 1], width: 2 })
  const e2 = parseLinePath(d, { color: [0, 0, 1, 1], width: 2 })
  expect(edgeToPath(e1)).toBe(d)
  // (100, 40) is exactly on the curve; the earlier edge wins the tie, far away is null
  expect(pickEdge([e1, e2], 100, 40, 0, 0, 1, 24, 5)).toBe(e1)
  expect(pickEdge([e1], 100, 4000, 0, 0, 1, 24, 5)).toBeNull()
})

function viewportsReset(fx) {
  fx.viewports.length = 0
}
