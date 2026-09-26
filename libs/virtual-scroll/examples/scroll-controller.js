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
          this.virtualScroll.render(this.container.scrollTop)
          this.onScroll(this.container.scrollTop)
          this.ticking = false
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

  destroy() {
    this.container.removeEventListener('scroll', this.scrollHandler)
    clearTimeout(this.resizeTimeout)
    this.resizeObserver.disconnect()
  }
}
