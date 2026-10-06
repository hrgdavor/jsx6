/**
 * Dependency-free wiring for `VirtualScroll`: `scroll` + `ResizeObserver`, a `requestAnimationFrame`
 * throttle and a small resize debounce.
 *
 * Copy this file. It is deliberately NOT part of the package surface — `files` ships no `examples/`,
 * and the package takes no runtime dependency — because the core is a pure function of
 * `(containerHeight, scrollTop)` and staying that way is what makes it testable without a browser.
 *
 * With the jsx6 stack, prefer [scroll-controller-observer.js](./scroll-controller-observer.js):
 * `@jsx6/dom-observer` shares one `ResizeObserver` for the whole page and its first entry doubles as
 * the initial viewport measurement.
 *
 * The region below is injected into [../README.md](../README.md) by `bun run docs:inject`.
 */
// #region controller
export class ScrollController {
  constructor({ virtualScroll, container, onScroll }) {
    this.virtualScroll = virtualScroll
    this.container = container
    this.onScroll = onScroll

    this.ticking = false
    this.resizeTimeout = null

    this.scrollHandler = () => {
      if (!this.ticking) {
        window.requestAnimationFrame(() => {
          try {
            this.virtualScroll.render(this.container.scrollTop)
            this.onScroll(this.container.scrollTop)
          } finally {
            // A throwing render (e.g. duplicate item keys) must not leave the loop wedged:
            // without this the next scroll would never be scheduled again.
            this.ticking = false
          }
        })
        this.ticking = true
      }
    }
    this.container.addEventListener('scroll', this.scrollHandler, { passive: true })

    this.resizeObserver = new ResizeObserver(() => {
      clearTimeout(this.resizeTimeout)
      this.resizeTimeout = setTimeout(() => {
        this.virtualScroll.updateViewport(this.container.clientHeight, this.container.scrollTop)
      }, 150)
    })
    this.resizeObserver.observe(this.container)
  }

  start() {
    this.virtualScroll.updateViewport(this.container.clientHeight, this.container.scrollTop)
  }

  /** Bring item `index` into view: the offset has to match the rows, then render that range. */
  scrollToIndex(index) {
    this.container.scrollTop = this.virtualScroll.getScrollTopForIndex(index)
    this.virtualScroll.render(this.container.scrollTop)
  }

  destroy() {
    this.container.removeEventListener('scroll', this.scrollHandler)
    clearTimeout(this.resizeTimeout)
    this.resizeObserver.disconnect()
  }
}
// #endregion controller
