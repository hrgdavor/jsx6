import { backend } from './runtime.js'

/**
 * A connector path. Both paths of a connector (the painted stroke and the wide
 * transparent hit stroke) are created here.
 *
 * There is deliberately NO `vector-effect: non-scaling-stroke`: the editor's zoom is a
 * CSS transform on `.ne-canvas`, which is an HTML ANCESTOR of this `<svg>`, and
 * `non-scaling-stroke` does not compensate for that — it only compensates transforms
 * INSIDE the SVG. Measured in Chrome (devicePixelRatio 1, `.ne-canvas{transform:scale(4)}`,
 * `stroke-width:2px`): 8 painted px with the property and 8 px without it, while the same
 * 2px stroke under an in-SVG `<g transform="scale(4)">` painted 2 px with it and 8 px
 * without. So the SVG line layer scales with zoom, and the canvas layer matches it by
 * stroking in world units (`canvasLineLayer.js`).
 *
 * @param {number} strength
 * @returns
 */
export const makeLine = strength =>
  backend.current.hSvg('path', {
    strength,
    style: `pointer-events:auto;cursor:pointer`,
    fill: 'none',
  })
