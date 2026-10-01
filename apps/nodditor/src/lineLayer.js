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
 *
 * `ConnectLine` always keeps its `<g>` + two `<path>`s and its `d` attribute;
 * the SVG layer attaches that element to the document, the canvas layer
 * leaves it detached and only reads `line.d` to build its edge list.
 */

/**
 * The default line layer: the classic SVG layer inside the scaled canvas.
 * It has zero dependencies (it is what the editor shipped with before the
 * layer seam) and works in every environment.
 *
 * @param {NodeEditor} editor
 */
export function createSvgLineLayer(editor) {
  return {
    kind: 'svg',
    /** @type {SVGElement} */
    el: editor.svgLayer,
    /**
     * Attach the line's `<g>` and let it select itself on click — the exact
     * pre-seam behaviour.
     * @param {ConnectLine} line
     */
    add(line) {
      listenUntil(line, line.el, 'click', () => {
        editor.selectConnector(line)
      })
      backend.current.insert(editor.svgLayer, line.el)
    },
    /**
     * Detach the line's element. (Its listeners are released by the editor's
     * `finalize(line)`; the layer owns only the element.)
     * @param {ConnectLine} line
     */
    remove(line) {
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
