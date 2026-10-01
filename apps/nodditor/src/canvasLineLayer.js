import { backend } from './runtime.js'

import { changeSeq } from './changeSeq.js'
import { createSvgLineLayer } from './lineLayer.js'
import { readLineTheme } from './lineTheme.js'

// Sampling of a connector for hit detection; the same value `pickEdge` would use if
// it had to sample the curve itself (it does not — the line caches the points).
const PICK_SEGMENTS = 24

// Selection state as a small integer, so refreshing a pinned edge compares a number
// instead of formatting a key. The order is the stylesheet's rule order for the same
// states — `.ne-to-sel-block` > `.ne-from-sel-block` > `.selected` > base — which is
// the one thing the `--ne-line-*` variables cannot express; keep the two in step.
const STATE_BASE = 0
const STATE_SELECTED = 1
const STATE_FROM = 2
const STATE_TO = 3

/**
 * The render edge of one line: the 8 geometry numbers the GPU packs, the per-frame
 * style (colour, width), the line's cached `points`/`pointsBox` for picking, and the
 * stamps that say which of those are still current. Pinned per line in `edgeCache`
 * and MUTATED in place, so a steady-state frame copies nothing and allocates nothing.
 *
 * @typedef {object} RenderEdge
 * @property {number} x0
 * @property {number} y0
 * @property {number} cx0
 * @property {number} cy0
 * @property {number} cx1
 * @property {number} cy1
 * @property {number} x1
 * @property {number} y1
 * @property {number[]} color - RGBA 0..1
 * @property {number} width - backing-store pixels (`worldWidth: false`)
 * @property {boolean} worldWidth
 * @property {Float64Array|null} points - the line's cached polyline (world coords)
 * @property {number[]|null} pointsBox - its AABB
 * @property {ConnectLine} line - how `pick` maps an edge back to its line
 * @property {number} ver - the `line.changeId` the geometry was copied at
 * @property {number} state - the selection state the colour was set for
 * @property {number} scale - the device pixel ratio the width was set for
 */

/**
 * Load `@jsx6/line-render`, nodditor's OPTIONAL dependency.
 *
 * The import is dynamic and wrapped: a host that did not install the package (or a
 * bundler that externalised it) gets `null` instead of a load error, and the editor
 * simply keeps its SVG line layer. The two failure modes are reported differently,
 * because they need different reactions: "not installed" is an expected host choice,
 * while a module that failed to evaluate is a bug that must not hide behind that
 * message. Either way the underlying error is logged.
 *
 * @returns {Promise<import('@jsx6/line-render')|null>}
 */
export async function loadLineRender() {
  try {
    return await import('@jsx6/line-render')
  } catch (err) {
    const missing =
      err?.code === 'ERR_MODULE_NOT_FOUND' ||
      err?.code === 'MODULE_NOT_FOUND' ||
      /cannot find (module|package)|failed to resolve (module|import)/i.test(err?.message ?? '')
    console.warn(
      missing
        ? 'NodeEditor: @jsx6/line-render is not installed (it is an optional dependency); ' +
            'keeping the SVG line layer.'
        : 'NodeEditor: @jsx6/line-render failed to load; keeping the SVG line layer.',
      err,
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
 * @param {{segmentsPerCurve?: number, device?: any, clear?: number[], supersample?: number, onLost?: (info: unknown) => void}} [opts]
 *   `device` is a `GPUDevice` to BORROW instead of requesting one, so several
 *   editors (each with its own canvas layer) can draw on ONE device; the device
 *   then stays the host's to destroy — see "Device ownership and sharing" in the
 *   `@jsx6/line-render` README. `clear` and `supersample` go straight to
 *   `LineRenderer.create` (the transparent default is `[0, 0, 0, 0]`; `supersample: 2`
 *   opts into the higher-quality antialiasing path and costs 4x the pixels). `onLost`
 *   is called once if the GPU device is lost (or the renderer throws) after the layer
 *   started drawing; the layer stops drawing and releases the renderer before the call.
 * @returns {object} a line layer (see `lineLayer.js`) plus `ready: Promise<void>`
 */
export function makeCanvasLineLayer(editor, lr, opts = {}) {
  const dpr = () => (typeof window != 'undefined' && window.devicePixelRatio) || 1

  /**
   * The four state colours of a theme, in `STATE_*` order. A function declaration (not
   * an arrow) because the theme is read below, before the rest of this factory runs.
   *
   * @param {typeof import('./lineTheme.js').LINE_THEME_DEFAULTS} theme
   * @returns {number[][]}
   */
  function stateColors(theme) {
    return [theme.base, theme.selected, theme.fromSel, theme.toSel]
  }

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
  /** @type {Map<ConnectLine, RenderEdge>} the pinned render edge of every known line */
  const edgeCache = new Map()
  /** @type {RenderEdge[]|null} edges for the last pick */
  let edges = null
  /** @type {number} `changeSeq()` value `edges` was built at (0 = never built) */
  let builtSeq = 0
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
   * The theme of both line layers (see `lineTheme.js`), read off the editor so it
   * resolves exactly as the stylesheet makes it resolve. It is re-read when the
   * editor's `class`/`style` changes — cheap, because that is a rare, attribute-level
   * event — and never per frame: resolving CSS custom properties in a render loop
   * would force a style recalculation for every line drawn.
   *
   * @type {import('./lineTheme.js').LINE_THEME_DEFAULTS}
   */
  let theme = readLineTheme(editor)
  /** @type {number[][]} colours indexed by the `STATE_*` constants, rebuilt with the theme */
  let themeColors = stateColors(theme)
  /** @type {MutationObserver|null} */
  let themeMO = null

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
   * The selection state of a line as one of the `STATE_*` constants. The order is the
   * stylesheet's rule order: to-selected beats from-selected beats selected.
   *
   * @param {{selected: boolean, fromSel: boolean, toSel: boolean}|undefined} st
   * @returns {number}
   */
  const stateOf = st =>
    !st ? STATE_BASE : st.toSel ? STATE_TO : st.fromSel ? STATE_FROM : st.selected ? STATE_SELECTED : STATE_BASE

  /**
   * The line's pinned render edge, refreshed in place. Three stamps decide what has to
   * be copied:
   *
   *  - `ver` vs `line.changeId` — the SHAPE changed: copy the 8 numbers and point the
   *    edge at the line's cached polyline (`line.samplePoints()`) and its AABB. Pan and
   *    zoom are absent by design: the points are in world coordinates and picking
   *    converts the pointer into that space, so a viewport change never invalidates
   *    geometry.
   *  - `state` — the selection changed, which is what the colour depends on.
   *  - `scale` — the device pixel ratio changed, which is the only thing the
   *    screen-pixel width depends on.
   *
   * @param {ConnectLine} line
   * @param {number} state
   * @param {number} scale
   * @returns {RenderEdge}
   */
  const edgeFor = (line, state, scale) => {
    let e = edgeCache.get(line)
    if (!e) {
      e = {
        x0: 0,
        y0: 0,
        cx0: 0,
        cy0: 0,
        cx1: 0,
        cy1: 0,
        x1: 0,
        y1: 0,
        color: themeColors[STATE_BASE],
        width: 0,
        worldWidth: false,
        points: null,
        pointsBox: null,
        line,
        ver: 0,
        state: -1,
        scale: -1,
      }
      edgeCache.set(line, e)
    }
    if (e.ver !== line.changeId) {
      const g = line.edge
      e.x0 = g.x0
      e.y0 = g.y0
      e.cx0 = g.cx0
      e.cy0 = g.cy0
      e.cx1 = g.cx1
      e.cy1 = g.cy1
      e.x1 = g.x1
      e.y1 = g.y1
      // the polyline (and its box) is the line's own cache: built once per shape
      // change, then reused by every pick at any pan/zoom
      e.points = line.samplePoints(PICK_SEGMENTS)
      e.pointsBox = line.pointsBox
      e.ver = line.changeId
    }
    if (e.state !== state) {
      e.color = themeColors[state]
      e.state = state
    }
    if (e.scale !== scale) {
      e.width = theme.widthCss * scale
      e.scale = scale
    }
    return e
  }

  /**
   * Build the edge list from the live lines. Every line that HAS a shape (`line.edge`)
   * contributes its PINNED render edge (`edgeFor`), refreshed only where it is stale —
   * the geometry is copied from the line's data and the polyline comes from the line's
   * own cache (`line.points`), so no frame parses an SVG string, samples a curve, or
   * allocates an edge object.
   *
   * @returns {RenderEdge[]}
   */
  const buildEdges = () => {
    const scale = dpr()
    const out = []
    for (const line of editor.lines) {
      if (!line.edge) continue
      out.push(edgeFor(line, stateOf(states.get(line)), scale))
    }
    builtSeq = changeSeq()
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

  /**
   * Re-read the theme and drop what came from it on the pinned edges: the colour and the
   * width. Rare by construction — it runs when the editor's `class`/`style` attribute
   * changes, never per frame.
   */
  const applyTheme = () => {
    theme = readLineTheme(editor)
    themeColors = stateColors(theme)
    for (const edge of edgeCache.values()) {
      edge.state = -1 // re-resolved from the new themeColors
      edge.scale = -1 // re-derived from the new widthCss
    }
    scheduleRender()
  }

  /** Watch the editor for a theme change (a class or style write). Idempotent. */
  const observeTheme = () => {
    if (themeMO || typeof MutationObserver != 'function') return
    themeMO = new MutationObserver(() => applyTheme())
    themeMO.observe(editor, { attributes: true, attributeFilter: ['class', 'style'] })
  }

  const releaseTheme = () => {
    themeMO?.disconnect()
    themeMO = null
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
      // a line added while the layer is installed must be pickable before the next
      // frame (the built list was made without it)
      edges = null
      scheduleRender()
    },
    /**
     * Unregister the line; it drops out of the next redraw and its pinned render edge
     * goes with it. The `<g>` element was never attached to the DOM in canvas mode, so
     * there is nothing to remove (its listeners are released by the editor's
     * `finalize(line)`).
     * @param {ConnectLine} line
     */
    remove(line) {
      states.delete(line)
      edgeCache.delete(line)
      let unsub = pathSubs.get(line)
      if (unsub) {
        unsub()
        pathSubs.delete(line)
      }
      // the built list still holds the removed line: drop it so a pick before the
      // next frame cannot return a line the editor no longer has
      edges = null
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
      // installed still picks the lines it has. The global change sequence answers
      // "did any connector move since that build?" in one comparison, which keeps a
      // click right after a drag from testing the previous geometry.
      if (!edges || lost || builtSeq !== changeSeq()) edges = buildEdges()
      if (!edges.length) return null
      const d = dpr()
      const rect = canvas.getBoundingClientRect()
      const sx = (clientX - rect.left) * d
      const sy = (clientY - rect.top) * d
      const edge = lr.pickEdge(edges, sx, sy, 0, 0, zoom * d, PICK_SEGMENTS, (theme.hitWidthCss / 2) * d)
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
      releaseTheme()
      disposeRenderer()
      pathSubs.forEach(unsub => unsub())
      pathSubs.clear()
      states.clear()
      edgeCache.clear()
      edges = null
      builtSeq = 0
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
      // the theme may have changed while the layer was disposed
      applyTheme()
      observeTheme()
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
      clear: opts.clear ?? [0, 0, 0, 0],
      segmentsPerCurve: opts.segmentsPerCurve || 32,
      // opt-in quality knob: `supersample: 2` renders at 2x and downscales (4x pixels)
      supersample: opts.supersample || 1,
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
  observeTheme()
  initRenderer()

  return layer
}

/**
 * Install the WebGPU canvas line layer on an editor, or leave the SVG layer alone —
 * the whole "probe, build, await ready, fall back" dance in one call, for hosts that
 * treat a missing GPU as a normal outcome.
 *
 * It resolves AFTER the layer is usable, so the return value says what is installed:
 *
 *   const { mode } = await installCanvasLineLayer(editor, { onLost: useSvgLayer })
 *   // mode === 'canvas' (drawing on the GPU) or 'svg' (WebGPU unavailable/failed)
 *
 * `mode: 'svg'` covers all three ways the canvas layer can refuse: the optional package
 * is not installed, the browser has no WebGPU (`LineRenderer.isSupported()`), or the
 * renderer could not start (`layer.ready` rejected) — in which case the failed layer is
 * swapped back out for a fresh SVG layer, and `error` carries the reason. A device lost
 * AFTER startup does the same swap (and then calls the host's `onLost`), so a host only
 * has to handle "we are on SVG now".
 *
 * @param {NodeEditor} editor
 * @param {{lr?: import('@jsx6/line-render')|null, segmentsPerCurve?: number, device?: any, clear?: number[], supersample?: number, onLost?: (info: unknown) => void}} [opts]
 *   `lr` is the already-loaded `@jsx6/line-render` module (when the host has it);
 *   the rest are handed to `makeCanvasLineLayer`.
 * @returns {Promise<{mode: 'canvas'|'svg', layer: object|null, error?: unknown}>}
 */
export async function installCanvasLineLayer(editor, opts = {}) {
  const { lr: injected, onLost, ...layerOpts } = opts
  const lr = injected || (await loadLineRender())
  if (!lr || !lr.LineRenderer?.isSupported?.()) return { mode: 'svg', layer: null }
  if (editor.destroyed) return { mode: 'svg', layer: null }

  /** Put the SVG layer back, but only while the canvas layer is still the active one. */
  let layer = null
  const fallback = () => {
    if (layer && editor.lineLayer === layer) editor.setLineLayer(createSvgLineLayer(editor))
  }

  layer = makeCanvasLineLayer(editor, lr, {
    ...layerOpts,
    // a lost device means "stop drawing on the GPU": degrade here, then tell the host
    onLost: info => {
      fallback()
      onLost?.(info)
    },
  })
  editor.setLineLayer(layer)
  try {
    await layer.ready
    return { mode: 'canvas', layer }
  } catch (error) {
    fallback()
    return { mode: 'svg', layer: null, error }
  }
}
