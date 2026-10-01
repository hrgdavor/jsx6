import { backend } from './runtime.js'
import { listenUntil } from './listenUntil.js'

/**
 * A line layer draws and hit-tests the editor's `ConnectLine`s. The editor is
 * written against this contract, so a layer can be swapped in and out at
 * runtime via `editor.setLineLayer()` — the graph, the selection and the
 * `ne-move` wiring all stay on the `ConnectLine`s themselves.
 *
 * Contract (every layer provides all of these):
 *
 *   kind: 'svg' | 'canvas'
 *   el: Element | null                    backing element in the editor DOM (null once disposed)
 *   add(line)                             register a new line (selection listeners, element placement)
 *   remove(line)                          unregister a line and release its element
 *   setStates(line, selected, fromSel, toSel)
 *                                        apply the three visual states: the line is selected, its
 *                                        source block is selected, its target block is selected
 *   pick(clientX, clientY)               the line under the point, or null
 *   onViewport(zoom)                     the editor zoom changed
 *   onResize(cssW, cssH)                 the editor box changed
 *   dispose()                            release everything the layer owns
 *   revive?()                            OPTIONAL: undo `dispose()` and make the layer usable again
 *
 * `dispose()` may be terminal or not, depending on the layer: the SVG layer owns nothing
 * (its `dispose()` is a no-op) and is therefore "revivable" by construction, while the
 * canvas layer releases its GPU session and its canvas element and comes back through
 * `revive()`. The editor uses that: passing the layer that is already installed
 * (`setLineLayer(activeLayer)`) calls `revive?.()` before its no-op return, and installing
 * a disposed layer elsewhere calls `onViewport`/`onResize` first, which revive it. A layer
 * that cannot come back may omit `revive`.
 *
 * `ConnectLine` always keeps its `<g>` + two `<path>`s and its shape as data
 * (`line.edge`) with the derived SVG text cached (`line.pathText`); the SVG layer
 * writes that text into the document, the canvas layer reads the data and its
 * sampled points and never formats a path string at all.
 */

/**
 * The default line layer: the classic SVG layer inside the scaled canvas.
 * It has zero dependencies (it is what the editor shipped with before the
 * layer seam) and works in every environment.
 *
 * It also owns the `<path d>` rendering: `ConnectLine` keeps the shape as data and
 * caches the SVG text (`line.pathText`), and this layer is what writes that text
 * into the line's two paths — on `add`, and again on every shape change it
 * subscribes to.
 *
 * @param {NodeEditor} editor
 */
export function createSvgLineLayer(editor) {
  /** @type {Map<ConnectLine, () => void>} unregister fns from `line.onPathChange` */
  const textSubs = new Map()

  /**
   * Put the line's cached shape text into its two `<path>`s. The text is built once
   * per shape change (in the line), so this is two `setAttribute` calls per move.
   *
   * @param {ConnectLine} line
   */
  const applyText = line => {
    const text = line.pathText
    line.line1.setAttribute('d', text)
    line.line2.setAttribute('d', text)
  }

  return {
    kind: 'svg',
    /** @type {SVGElement} */
    el: editor.svgLayer,
    /**
     * Attach the line's `<g>`, let it select itself on click — the exact
     * pre-seam behaviour — and follow its shape.
     * @param {ConnectLine} line
     */
    add(line) {
      listenUntil(line, line.el, 'click', () => {
        editor.selectConnector(line)
      })
      // the layer renders: a shape change re-applies the text (a line being dragged
      // fires no `ne-move`, so this is the only thing that keeps it in sync)
      textSubs.get(line)?.()
      textSubs.set(
        line,
        line.onPathChange(() => applyText(line)),
      )
      applyText(line)
      backend.current.insert(editor.svgLayer, line.el)
    },
    /**
     * Detach the line's element and stop following its shape. (The line's other
     * listeners are released by the editor's `finalize(line)`; the layer owns only
     * the element and this subscription — which must go, because `setLineLayer`
     * takes the lines off a layer without finalizing them.)
     * @param {ConnectLine} line
     */
    remove(line) {
      textSubs.get(line)?.()
      textSubs.delete(line)
      backend.current.remove(line.el)
    },
    /**
     * Apply the three visual states with the same `classIf` calls the CSS
     * (`.selected`, `.ne-from-sel-block`, `.ne-to-sel-block`) keys on.
     * @param {ConnectLine} line
     * @param {boolean} selected
     * @param {boolean} fromSel
     * @param {boolean} toSel
     */
    setStates(line, selected, fromSel, toSel) {
      backend.current.classIf(line.el, 'selected', selected)
      backend.current.classIf(line.el, 'ne-from-sel-block', fromSel)
      backend.current.classIf(line.el, 'ne-to-sel-block', toSel)
    },
    /**
     * Never hit: in SVG mode the `<g>`'s own click listener selects the line,
     * and the editor's `g`-lookup resolves right-click / Enter / Space.
     * @returns {null}
     */
    pick() {
      return null
    },
    onViewport() {},
    onResize() {},
    /**
     * Nothing to release: the `<svg>` element stays owned by the editor.
     */
    dispose() {},
  }
}
