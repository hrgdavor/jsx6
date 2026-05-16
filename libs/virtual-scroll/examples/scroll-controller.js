export class ScrollController {

    constructor({ virtualScroll, container, onScroll }) {

        this.virtualScroll = virtualScroll
        this.container = container
        this.onScroll = onScroll

        this.ticking = false

        this.container.addEventListener('scroll', () => {

            if (!this.ticking) {
                window.requestAnimationFrame(() => {
                    this.virtualScroll.render(this.container.scrollTop)
                    this.onScroll(this.container.scrollTop)
                    this.ticking = false
                })
                this.ticking = true
            }
        }, { passive: true })

        const debouncedResize = debounce(() => {
            this.virtualScroll.updateViewport(this.container.clientHeight, this.container.scrollTop)
        }, 150)

        this.resizeObserver = new ResizeObserver(() => {
            debouncedResize()
        })
        this.resizeObserver.observe(this.container)
    }

    start() {
        this.virtualScroll.updateViewport(this.container.clientHeight, this.container.scrollTop)
    }
}

function debounce(func, wait) {
    let timeout
    return (...args) => {
        clearTimeout(timeout)
        timeout = setTimeout(() => func.apply(this, args), wait)
    }
}
