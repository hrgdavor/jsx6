import { backend } from './runtime.js'

// The line colors as [r, g, b, a] in 0..1, mirroring the `.ne-svg-layer` rules in
// static/nodditor.css. Priority follows the stylesheet's rule order:
// `.ne-to-sel-block` > `.ne-from-sel-block` > `.selected` > black.
const COLOR_BASE = [0, 0, 0, 1] // path:first-child { stroke: black }
const COLOR_SELECTED = [46 / 255, 167 / 255, 167 / 255, 1] // #2ea7a7, g.selected
const COLOR_FROM = [191 / 255, 194 / 255, 51 / 255, 1] // #bfc233, g.ne-from-sel-block
const COLOR_TO = [46 / 255, 108 / 255, 167 / 255, 1] // #2e6ca7, g.ne-to-sel-block

// The SVG hit path is an invisible 8 CSS px wide stroke (`vector-effect:
// non-scaling-stroke`), so its half-width — the canvas pick radius — is 4 CSS px.
const PICK_RADIUS_CSS = 4
// The rendered stroke is 2 CSS px at any zoom (`vector-effect: non-scaling-stroke`).
const LINE_WIDTH_CSS = 2

/**
 * Load `@jsx6/line-render`, nodditor's OPTIONAL dependency.
 *
 * The import is dynamic and wrapped: a host that did not install the package
 * (or a bundler that externalised it) gets `null` instead of a load error, and
 * the editor simply keeps its SVG line layer.
 *
 * @returns {Promise<import('@jsx6/line-render')|null>}
 */
export async function loadLineRender() {
  try {
    return await import('@jsx6/line-render')
  } catch (err) {
    console.warn(
      'NodeEditor: @jsx6/line-render is not installed (it is an optional dependency); ' + 'keeping the SVG line layer.',
    )
    return null
  }
}

/**
 * Create the canvas line layer: a WebGPU `<canvas>` (see `@jsx6/line-render`)
 * that draws the editor's lines underneath the block canvas.
 *
 * Synchronous on purpose — the canvas element is created and inserted right
 * away, and picking (pure curve math, no GPU) works from the start. The GPU
 * renderer is initialised lazily: `layer.ready` resolves when drawing can
 * begin and rejects when WebGPU is unavailable, or when the layer is disposed
 * before the GPU came up (so a host awaiting `ready` is never left hanging).
 * After a rejection the canvas stays blank but `pick()` still works; a host
 * should treat that as "fall back to the SVG layer" (the demo does).
 *
 * `dispose()` is not the end of the object: it releases the GPU session, the
 * listeners, the pixel-ratio watch and the canvas element, and `revive()` brings
 * the same layer back with a fresh session and a fresh `ready`. The editor does
 * that itself when a disposed layer is re-installed (`setLineLayer` on the
 * current layer, or the `onViewport`/`onResize` it calls on a new one), so a host
 * can keep its canvas layer around and hand it back instead of building a new
 * one. A stale GPU startup or a stale rAF frame can never leak into the new life
 * — both carry the life they started in.
 *
 * A device that is lost AFTER startup (driver reset, GPU process crash) — or a
 * renderer that throws instead of reporting one — is handed to `opts.onLost`
 * once, and drawing stops. A host should fall back to the SVG layer there too;
 * the demo does. The loss raised by this layer's own `dispose()` is not
 * reported.
 *
 * Geometry: the canvas covers the editor box in CSS pixels; its backing store
 * is `css * devicePixelRatio`, and the renderer viewport is `zoom * dpr` with
 * pan `(0, 0)` — nodditor's `.ne-canvas` is scaled from the top-left and panning
 * moves the blocks, not the layer. A change of `devicePixelRatio` (moving the
 * window to another display, browser zoom) re-derives both, so the layer does
 * not go blurry or pick at the wrong scale.
 *
 * A line being connected is drawn too: while its free end follows the pointer
 * (`p2.con` still null, `d` recomputed by `ConnectLine.updatePath`) the layer
 * has subscribed to `ConnectLine.onPathChange`, so the temporary connector
 * tracks the pointer. Redraws are rAF-batched — per frame the cost is one
 * `parseLinePath` per line plus one instanced GPU draw, the same budget as the
 * `ne-move`/zoom redraw path: no per-event render, no per-line canvas, no
 * buffer churn.
 *
 * @param {NodeEditor} editor
 * @param {import('@jsx6/line-render')} lr the loaded `@jsx6/line-render` module
 * @param {{segmentsPerCurve?: number, device?: any, onLost?: (info: unknown) => void}} [opts]
 *   `device` is a `GPUDevice` to BORROW instead of requesting one, so several
 *   editors (each with its own canvas layer) can draw on ONE device; the device
 *   then stays the host's to destroy — see "Device ownership and sharing" in the
 *   `@jsx6/line-render` README. `onLost` is called once if the GPU device is lost
 *   (or the renderer throws) after the layer started drawing; the layer stops
 *   drawing and releases the renderer before the call.
 * @returns {object} a line layer (see `lineLayer.js`) plus `ready: Promise<void>`
 */
export function makeCanvasLineLayer(editor, lr, opts = {}) {
  const dpr = () => (typeof window != 'undefined' && window.devicePixelRatio) || 1

  const canvas = document.createElement('canvas')
  canvas.className = 'ne-canvas-line-layer'
  // Below `.ne-canvas` in DOM order: the blocks (and, in SVG mode, the lines)
  // paint over it, and clicks fall through it (`pointer-events: none` in the
  // stylesheet).
  editor.insertBefore(canvas, editor.contentArea)

  /** @type {Map<ConnectLine, {selected: boolean, fromSel: boolean, toSel: boolean}>} */
  const states = new Map()
  /** @type {Map<ConnectLine, () => void>} unregister fns from `ConnectLine.onPathChange` */
  const pathSubs = new Map()
  /** @type {import('@jsx6/line-render').Edge[]|null} edges for the last pick */
  let edges = null
  /** @type {number} */
  let zoom = 1
  /** @type {number} editor box size in CSS px, as last reported by `onResize` */
  let cssW = 0
  /** @type {number} */
  let cssH = 0
  /** @type {import('@jsx6/line-render').LineRenderer|null} */
  let renderer = null
  /** @type {number} */
  let raf = 0
  /** @type {boolean} */
  let disposed = false
  /** @type {boolean} the GPU is gone (or the renderer threw): stop drawing */
  let lost = false
  /** @type {MediaQueryList|null} */
  let dprQuery = null
  /** @type {(() => void)|null} */
  let releaseClick = null
  /** @type {(() => void)|null} */
  let releaseMove = null

  /**
   * Life counter: bumped by `dispose()` AND by `revive()`. Every asynchronous
   * continuation (the GPU startup, the rAF redraw) carries the value it started
   * with and refuses to touch state once the layer has moved on — otherwise a
   * `create()` that resolves after a dispose + revive would publish a renderer
   * from the previous life, and the device it acquired would leak.
   * @type {number}
   */
  let life = 0

  /** @type {Promise<void>} the CURRENT life's readiness — a fresh promise after every revive */
  let ready
  /** @type {(err?: Error) => void} */
  let settleReady = () => {}

  /** Create the `ready` promise (and its one-shot settle function) for the current life. */
  const newReady = () => {
    let settled = false
    ready = new Promise((resolve, reject) => {
      settleReady = err => {
        if (settled) return
        settled = true
        if (err) reject(err)
        else resolve()
      }
    })
  }
  newReady()

  /**
   * Build the edge list from the live lines: every line that HAS A PATH
   * contributes its `d` (kept up to date by `ConnectLine.updatePath`) in its
   * current visual state — including a line being connected, whose free end
   * is a raw pointer position (`p2.con` still null) and which the SVG layer
   * draws too.
   *
   * Per-frame cost is one regex parse per line plus one instanced draw — the
   * same budget as the `ne-move`/zoom path. If graphs ever grow into the
   * thousands, a `d`-keyed edge cache is the next lever (the parse is still far
   * cheaper than the GPU pass).
   *
   * @returns {import('@jsx6/line-render').Edge[]}
   */
  const buildEdges = () => {
    const d = dpr()
    const out = []
    for (const line of editor.lines) {
      if (!line.d) continue
      const st = states.get(line) || { selected: false, fromSel: false, toSel: false }
      // stylesheet rule order: to-sel beats from-sel beats selected
      const color = st.toSel ? COLOR_TO : st.fromSel ? COLOR_FROM : st.selected ? COLOR_SELECTED : COLOR_BASE
      const edge = lr.parseLinePath(line.d, { color, width: LINE_WIDTH_CSS * d, worldWidth: false })
      edge.line = line // `pick` maps an edge back to its ConnectLine
      out.push(edge)
    }
    return out
  }

  /**
   * Release the renderer (idempotent). A failed `init()` may have left a
   * half-initialised one behind, and a lost device must be dropped too.
   */
  const disposeRenderer = () => {
    if (!renderer) return
    const r = renderer
    renderer = null
    try {
      r.dispose()
    } catch {
      // the renderer may have failed to initialise; nothing to release
    }
  }

  /**
   * The GPU is gone: stop drawing at once, release the renderer and tell the
   * host ONCE, so it can fall back to the SVG layer (the same contract as a
   * rejected `ready`). Reached from the renderer's `onLost` and from a
   * `render()` that threw.
   *
   * @param {unknown} info
   */
  const handleLost = info => {
    if (disposed || lost) return
    lost = true
    disposeRenderer()
    opts.onLost?.(info)
  }

  /** One rAF-batched full redraw; the edge list is rebuilt every time (cheap: one `d` read per line). */
  const scheduleRender = () => {
    if (disposed || raf || lost) return
    const gen = life
    raf = requestAnimationFrame(() => {
      raf = 0
      // a frame scheduled by a previous life must not draw into this one
      if (gen !== life || disposed || lost) return
      edges = buildEdges()
      if (renderer) {
        try {
          renderer.render(edges)
        } catch (err) {
          // a device lost between frames (or a broken pipeline): `onLost` is the
          // host's cue to fall back, and `handleLost` stops the redraw loop
          handleLost(err)
        }
      }
    })
  }

  /**
   * Register a line's visual state and its path listener. Idempotent: a
   * re-installed (or revived) layer can be handed the same line twice — the
   * editor re-adds every line after `onViewport`/`onResize`, and `revive()`
   * already picked up the ones it knows.
   *
   * @param {ConnectLine} line
   */
  const registerLine = line => {
    // While a free end is being dragged the line's `d` changes without any
    // `ne-move` event; the path listener funnels those updates into the same
    // rAF-batched redraw (see `scheduleRender`).
    pathSubs.get(line)?.()
    states.set(line, { selected: line.selected || false, fromSel: false, toSel: false })
    pathSubs.set(
      line,
      line.onPathChange(() => scheduleRender()),
    )
  }

  /**
   * Apply the current box size and device pixel ratio to the canvas and the
   * renderer viewport. Called on every resize, on every DPR change and once
   * when the GPU comes up.
   */
  const applySize = () => {
    const d = dpr()
    canvas.width = Math.max(1, Math.round(cssW * d))
    canvas.height = Math.max(1, Math.round(cssH * d))
    if (renderer) renderer.setViewport(0, 0, zoom * d)
    scheduleRender()
  }

  /** Stop watching the current `devicePixelRatio` query. */
  const releaseDpr = () => {
    if (!dprQuery) return
    if (dprQuery.removeEventListener) dprQuery.removeEventListener('change', onDprChange)
    else dprQuery.removeListener?.(onDprChange)
    dprQuery = null
  }

  /** The ratio changed: watch the new one and re-derive the backing store. */
  const onDprChange = () => {
    if (disposed) return
    watchDpr()
    applySize()
  }

  /**
   * (Re-)arm the `devicePixelRatio` watch: a `matchMedia` query that changes
   * exactly when the ratio does. Without it the backing store keeps the ratio
   * it was created with — a window dragged to another display draws blurry
   * lines and picks at the wrong scale.
   */
  const watchDpr = () => {
    if (typeof window == 'undefined' || !window.matchMedia) return
    // the previous query is for the PREVIOUS ratio and never fires again
    releaseDpr()
    dprQuery = window.matchMedia(`(resolution: ${dpr()}dppx)`)
    // happy-dom has both; a MediaQueryList only implements one of them depending
    // on how old the DOM implementation is
    if (dprQuery.addEventListener) dprQuery.addEventListener('change', onDprChange)
    else dprQuery.addListener?.(onDprChange)
  }

  const onClick = e => {
    // A click that landed on a block is the block's (SVG mode selects through
    // the line `<g>`s; here blocks still intercept the click).
    let node = backend.current.findParent(e.target, p => p.hasAttribute && p.hasAttribute('nid'))
    if (node) return
    const line = layer.pick(e.clientX, e.clientY)
    if (line) editor.selectConnector(line)
    // Empty canvas: the `pointerup` handler already deselected; nothing to do.
  }

  /** Release the editor-level listeners (idempotent). */
  const releaseEvents = () => {
    releaseClick?.()
    releaseMove?.()
    releaseClick = null
    releaseMove = null
  }

  /** (Re-)register the editor-level listeners. */
  const listenEvents = () => {
    releaseEvents()
    releaseClick = backend.current.listen(editor, 'click', onClick)
    releaseMove = backend.current.listenCustom(editor, 'ne-move', () => {
      scheduleRender()
    })
  }
  listenEvents()

  /** @type {object} the layer */
  const layer = {
    kind: 'canvas',
    /** @type {HTMLCanvasElement} */
    el: canvas,
    /** The current life's GPU readiness. @type {Promise<void>} */
    get ready() {
      return ready
    },
    /** True while the layer is disposed and can be brought back with `revive()`. @type {boolean} */
    get disposed() {
      return disposed
    },

    /**
     * Register the line; it joins the next redraw.
     * @param {ConnectLine} line
     */
    add(line) {
      registerLine(line)
      scheduleRender()
    },
    /**
     * Unregister the line; it drops out of the next redraw. The `<g>` element
     * was never attached to the DOM in canvas mode, so there is nothing to
     * remove (its listeners are released by the editor's `finalize(line)`).
     * @param {ConnectLine} line
     */
    remove(line) {
      states.delete(line)
      let unsub = pathSubs.get(line)
      if (unsub) {
        unsub()
        pathSubs.delete(line)
      }
      scheduleRender()
    },
    /**
     * @param {ConnectLine} line
     * @param {boolean} selected
     * @param {boolean} fromSel
     * @param {boolean} toSel
     */
    setStates(line, selected, fromSel, toSel) {
      states.set(line, { selected, fromSel, toSel })
      scheduleRender()
    },
    /**
     * Pick a line under the point. Pure curve math — works even before (or
     * without) the GPU renderer.
     *
     * The click is converted to the canvas backing store (client box × dpr)
     * and handed to `pickEdge` with viewport `zoom * dpr`, pan `(0, 0)` and a
     * pick radius of 4 CSS px in backing pixels — the same half-width as the
     * SVG hit path, so picking feels identical in both layers.
     *
     * @param {number} clientX
     * @param {number} clientY
     * @returns {ConnectLine|null}
     */
    pick(clientX, clientY) {
      // `pick` must not wait for the first redraw, and after a device loss nothing
      // rebuilds the list at all (the redraw loop stopped) — so a layer that stays
      // installed still picks the lines it has
      if (!edges || lost) edges = buildEdges()
      if (!edges.length) return null
      const d = dpr()
      const rect = canvas.getBoundingClientRect()
      const sx = (clientX - rect.left) * d
      const sy = (clientY - rect.top) * d
      const edge = lr.pickEdge(edges, sx, sy, 0, 0, zoom * d, 24, PICK_RADIUS_CSS * d)
      return edge ? edgeToLine(edge) : null
    },
    /**
     * @param {number} z
     */
    onViewport(z) {
      zoom = z
      // the editor calls this FIRST when it installs a layer, so a disposed layer
      // comes back here (see `revive`)
      layer.revive()
      if (renderer) renderer.setViewport(0, 0, zoom * dpr())
      scheduleRender()
    },
    /**
     * @param {number} w editor box width in CSS px
     * @param {number} h editor box height in CSS px
     */
    onResize(w, h) {
      // `realWidth`/`realHeight` are `undefined` until the editor's ResizeObserver
      // fires; treat that as "no size yet" rather than NaN.
      cssW = w || 0
      cssH = h || 0
      layer.revive()
      applySize()
    },
    /**
     * Release everything the layer owns: the GPU session, the listeners, the
     * pixel-ratio watch, the per-line state and the canvas element.
     *
     * The layer OBJECT survives — `revive()` (or re-installing it through
     * `editor.setLineLayer`, which calls `revive()` for you) brings it back with
     * a fresh GPU session and a fresh `ready`. The `ready` of the life being
     * disposed rejects with an `AbortError`, so nobody is left waiting; the next
     * life gets a new one. Idempotent.
     */
    dispose() {
      if (disposed) return
      disposed = true
      life++ // every in-flight continuation (GPU startup, rAF) is now stale
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      releaseEvents()
      releaseDpr()
      disposeRenderer()
      pathSubs.forEach(unsub => unsub())
      pathSubs.clear()
      states.clear()
      edges = null
      settleReady(Object.assign(new Error('the canvas line layer was disposed'), { name: 'AbortError' }))
      canvas.remove()
    },
    /**
     * Bring a disposed layer back: the same canvas element goes back into the
     * editor, the listeners and the pixel-ratio watch are re-armed, the editor's
     * current lines are registered again, and a NEW GPU session starts (so
     * `ready` is a new promise, not the rejected one).
     *
     * Idempotent — a live layer ignores it — and safe to call while the layer is
     * still the editor's active one, which is the case `onViewport`/`onResize`
     * cover for the re-install path.
     */
    revive() {
      if (!disposed) return
      // a destroyed editor never disposes its layers again: reviving here would
      // acquire a GPU session that nothing can release
      if (editor.destroyed) return
      disposed = false
      life++
      lost = false
      editor.insertBefore(canvas, editor.contentArea)
      listenEvents()
      watchDpr()
      newReady()
      // `onViewport`/`onResize` run BEFORE the lines when the editor re-installs a
      // layer, and a host may revive a layer it never re-installs — either way the
      // layer has to pick the editor's lines up itself (`add` is idempotent)
      editor.lines.forEach(registerLine)
      initRenderer()
    },
  }

  /**
   * Map a picked edge back to its `ConnectLine` (stamped by `buildEdges`).
   * @param {import('@jsx6/line-render').Edge} edge
   * @returns {ConnectLine|null}
   */
  const edgeToLine = edge => edge.line

  /**
   * Bring up the GPU renderer. The renderer is only published (and the layer
   * only allowed to draw) once it is initialised AND the life that asked for it
   * is still the current one: a `dispose()` — or a dispose + revive — while the
   * GPU was coming up would otherwise leave an orphaned device behind, or
   * publish a stale renderer over the new life's.
   *
   * The host-facing helpers do the throwing-free part: `isSupported()` is a
   * synchronous probe (no WebGPU → `ready` rejects without asking for an
   * adapter), and `create()` reports the cause to the console, cleans up what it
   * half-acquired and resolves with `null` instead of throwing.
   */
  const initRenderer = async () => {
    const gen = life
    if (!lr.LineRenderer.isSupported()) {
      settleReady(new Error('WebGPU is not available (navigator.gpu) — keeping the SVG line layer'))
      return
    }
    const created = await lr.LineRenderer.create(canvas, {
      // transparent clear: the editor's own background shows through
      clear: [0, 0, 0, 0],
      segmentsPerCurve: opts.segmentsPerCurve || 32,
      // a host can hand in its own device, so several editors share one
      device: opts.device || null,
      onLost: info => handleLost(info),
    })
    if (gen !== life || disposed) {
      // disposed (or disposed AND revived) while the adapter/device was being
      // acquired: release what this stale call acquired and stay out of the way
      created?.dispose()
      return
    }
    if (!created || lost) {
      // either nothing could be started, or the device was lost while it was
      // starting up (then `onLost` has already told the host)
      if (created) created.dispose()
      settleReady(new Error('the WebGPU renderer could not be started — keeping the SVG line layer'))
      return
    }
    renderer = created
    renderer.setViewport(0, 0, zoom * dpr())
    settleReady()
    scheduleRender()
  }
  watchDpr()
  initRenderer()

  return layer
}
