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
 * begin and rejects when WebGPU is unavailable. After a rejection the canvas
 * stays blank but `pick()` still works; a host should treat that as "fall back
 * to the SVG layer" (the demo does).
 *
 * Geometry: the canvas covers the editor box in CSS pixels; its backing store
 * is `css * devicePixelRatio`, and the renderer viewport is `zoom * dpr` with
 * pan `(0, 0)` — nodditor's `.ne-canvas` is scaled from the top-left and panning
 * moves the blocks, not the layer.
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
 * @param {{segmentsPerCurve?: number}} [opts]
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
  /** @type {import('@jsx6/line-render').LineRenderer|null} */
  let renderer = null
  /** @type {number} */
  let raf = 0
  /** @type {boolean} */
  let disposed = false

  /** @type {Promise<void>} resolves when the renderer is ready, rejects if WebGPU is unavailable */
  let ready
  /** @type {() => void} */
  let resolveReady
  /** @type {(err: Error) => void} */
  let rejectReady
  ready = new Promise((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })

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

  /** One rAF-batched full redraw; the edge list is rebuilt every time (cheap: one `d` read per line). */
  const scheduleRender = () => {
    if (disposed || raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      if (disposed) return
      edges = buildEdges()
      if (renderer) renderer.render(edges)
    })
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
  const releaseClick = backend.current.listen(editor, 'click', onClick)
  const releaseMove = backend.current.listenCustom(editor, 'ne-move', () => {
    scheduleRender()
  })

  /** @type {object} the layer */
  const layer = {
    kind: 'canvas',
    /** @type {HTMLCanvasElement} */
    el: canvas,
    /** @type {Promise<void>} GPU renderer ready (or rejected) */
    ready,

    /**
     * Register the line; it joins the next redraw.
     * @param {ConnectLine} line
     */
    add(line) {
      states.set(line, { selected: line.selected || false, fromSel: false, toSel: false })
      // While a free end is being dragged the line's `d` changes without any
      // `ne-move` event; the path listener funnels those updates into the same
      // rAF-batched redraw (see `scheduleRender`).
      pathSubs.set(
        line,
        line.onPathChange(() => scheduleRender()),
      )
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
      if (!edges) edges = buildEdges() // pick must not wait for the first redraw
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
      if (renderer) renderer.setViewport(0, 0, zoom * dpr())
      scheduleRender()
    },
    /**
     * @param {number} cssW
     * @param {number} cssH
     */
    onResize(cssW, cssH) {
      const d = dpr()
      // `realWidth`/`realHeight` are `undefined` until the editor's ResizeObserver
      // fires; treat that as "no size yet" rather than NaN.
      canvas.width = Math.max(1, Math.round((cssW || 0) * d))
      canvas.height = Math.max(1, Math.round((cssH || 0) * d))
      scheduleRender()
    },
    /**
     * Stop the renderer, release both listeners and remove the canvas.
     */
    dispose() {
      if (disposed) return
      disposed = true
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      releaseClick()
      releaseMove()
      if (renderer) {
        try {
          renderer.dispose()
        } catch {
          // the renderer may have failed to initialise; nothing to release
        }
        renderer = null
      }
      pathSubs.forEach(unsub => unsub())
      pathSubs.clear()
      states.clear()
      edges = null
      canvas.remove()
    },
  }

  /**
   * Map a picked edge back to its `ConnectLine` (stamped by `buildEdges`).
   * @param {import('@jsx6/line-render').Edge} edge
   * @returns {ConnectLine|null}
   */
  const edgeToLine = edge => edge.line

  const initRenderer = async () => {
    try {
      renderer = new lr.LineRenderer(canvas, {
        // transparent clear: the editor's own background shows through
        clear: [0, 0, 0, 0],
        segmentsPerCurve: opts.segmentsPerCurve || 32,
      })
      await renderer.init()
      renderer.setViewport(0, 0, zoom * dpr())
      resolveReady()
      scheduleRender()
    } catch (err) {
      rejectReady(err)
      if (renderer) {
        try {
          renderer.dispose()
        } catch {
          // ignore
        }
        renderer = null
      }
    }
  }
  initRenderer()

  return layer
}
