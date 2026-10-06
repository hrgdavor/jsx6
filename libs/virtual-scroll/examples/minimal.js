/**
 * The smallest complete setup — markup, config, wiring — with nothing else going on.
 *
 * It is a real, runnable module (the browser probe loads it), and the body between the region markers
 * is injected into [../README.md](../README.md) by `bun run docs:inject`, so the README cannot drift
 * from code that runs.
 *
 * This wiring is deliberately plain. The hardened versions — a rAF-throttled scroll handler that
 * cannot wedge when a render throws, a debounced resize, and `scrollToIndex` — are the copyable
 * controllers in ./scroll-controller.js and ./scroll-controller-observer.js.
 *
 * Expected markup (see the README quick start):
 *   <div id="scroller"><div id="spacer"></div><div id="rows"></div></div>
 */
import { VirtualScroll } from '../index.js'

// #region minimal
const scroller = document.getElementById('scroller')
const rows = document.getElementById('rows')

const items = Array.from({ length: 10000 }, (_, i) => ({ id: i, title: `Item ${i}` }))

const vs = new VirtualScroll({
  itemsContainer: rows,
  scroller, // only needed for scrollToIndex()
  itemHeight: 32,
  items,
  createItem: () => {
    const el = document.createElement('div')
    el.className = 'vs-row'
    return el
  },
  updateItemContent: (el, item) => {
    el.textContent = item.title
  },
})

// the rows add no height of their own, so the scroller is sized by the spacer
document.getElementById('spacer').style.height = `${vs.getTotalHeight()}px`

// render on scroll (one frame at a time), re-measure when the scroller resizes
let frame = 0
scroller.addEventListener(
  'scroll',
  () => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      vs.render(scroller.scrollTop)
    })
  },
  { passive: true },
)
new ResizeObserver(() => vs.updateViewport(scroller.clientHeight, scroller.scrollTop)).observe(scroller)

// updateViewport() stores the viewport height and renders the first frame
vs.updateViewport(scroller.clientHeight, 0)
// #endregion minimal

export { vs }
