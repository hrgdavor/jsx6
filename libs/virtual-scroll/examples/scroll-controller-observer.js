/**
 * The same wiring using the stack's shared observers.
 *
 * `observeResize` from `@jsx6/dom-observer` keeps ONE `ResizeObserver` for the whole page instead of
 * one per scrolled list, and always delivers an initial entry — so the first callback is also the
 * initial viewport measurement and the debounce is not needed (`updateViewport` only re-renders the
 * rows on screen, it does not re-measure them).
 *
 * `@jsx6/dom-observer` is intentionally NOT a dependency of this package; install it (it is already
 * part of the jsx6 stack) or use the dependency-free [scroll-controller.js](./scroll-controller.js).
 *
 * The region below is injected into [../README.md](../README.md) by `bun run docs:inject`.
 */
// #region observer-controller
import { observeResize } from '@jsx6/dom-observer'

export class ScrollController {
  constructor({ virtualScroll, container, onScroll }) {
    this.virtualScroll = virtualScroll
    this.container = container
    this.onScroll = onScroll
    this.frame = 0

    this.scrollHandler = () => {
      if (this.frame) return
      this.frame = window.requestAnimationFrame(() => {
        this.frame = 0
        this.virtualScroll.render(this.container.scrollTop)
        this.onScroll(this.container.scrollTop)
      })
    }
    this.container.addEventListener('scroll', this.scrollHandler, { passive: true })

    // Fires immediately on observe(), so this is the first measurement too. `clientHeight` (not
    // `contentRect.height`) is the scrollport height: it includes padding and excludes scrollbars,
    // which is exactly the band the rows have to cover.
    this.stopResize = observeResize(this.container, () => {
      this.virtualScroll.updateViewport(this.container.clientHeight, this.container.scrollTop)
    })
  }

  /** Bring item `index` into view: the offset has to match the rows, then render that range. */
  scrollToIndex(index) {
    this.container.scrollTop = this.virtualScroll.getScrollTopForIndex(index)
    this.virtualScroll.render(this.container.scrollTop)
  }

  destroy() {
    this.container.removeEventListener('scroll', this.scrollHandler)
    if (this.frame) window.cancelAnimationFrame(this.frame)
    this.stopResize()
  }
}
// #endregion observer-controller
