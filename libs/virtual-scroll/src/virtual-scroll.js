/**
 * @typedef {Object} VirtualScrollConfig
 * @property {HTMLElement} itemsContainer - The DOM element that holds the list items.
 * @property {number} itemHeight - The fixed height of each row in pixels.
 * @property {Array<any>} items - The full array of data items to render.
 * @property {number} [buffer=0] - Number of items to render above/below the viewport.
 * @property {number} [offsetTop=0] - Vertical offset for the start of the list.
 * @property {function(): HTMLElement} createItem - Factory function to create a new list item DOM element.
 * @property {function(HTMLElement, any): void} updateItemContent - Function to bind data to a recycled DOM element.
 * @property {function(any): string|number} [getKey] - Function to get a unique identifier for an item. Defaults to item.id.
*/

/**
 * VirtualScroll class encapsulates the logic for high-performance scrolling
 * of large lists by recycling a pool of DOM elements using identity-aware reconciliation.
 */
export class VirtualScroll {
    
    /**
     * @param {VirtualScrollConfig} config
     */
    constructor(config) {
        this.itemsContainer = config.itemsContainer
        this.itemHeight = config.itemHeight
        this.items = config.items
        this.buffer = config.buffer || 0
        this.offsetTop = config.offsetTop || 0

        this.createItem = config.createItem
        this.updateItemContent = config.updateItemContent

        this.getKey = config.getKey || (item => item.id)

        // domPool: Map<key, HTMLElement> — currently rendered elements
        this.idDomMap = new Map()
        // unusedPool: Array<HTMLElement> — recycled elements ready for reuse
        this.unusedPool = []

        this.poolSize = 0
    }

    /**
     * Initialize pool and render visible range.
     */
    updateViewport(containerHeight, scrollTop) {
        this.poolSize = Math.ceil(containerHeight / this.itemHeight) + (this.buffer * 2)
        this.render(scrollTop)
    }

    /**
     * Single unified update: evict off-screen, mount on-screen.
     */
    render(scrollTop) {
        const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer)
        const end = Math.min(this.items.length, start + this.poolSize)

        // Process visible range
        const oldDomMap = this.idDomMap
        this.idDomMap = new Map()
        for (let i = start; i < end; i++) {
            const item = this.items[i]
            const key = this.getKey(item)
            const el = oldDomMap.get(key)
            if(!el) continue

            oldDomMap.delete(key)
            this.idDomMap.set(key, el)
        }
        for(const [key, value] of oldDomMap) {
            this.unusedPool.push(value)
        }

        
        for (let i = start; i < end; i++) {
            const item = this.items[i]
            const key = this.getKey(item)

            if (this.idDomMap.has(key)) {
                // Already mounted — just update position
                this.translateElement(this.idDomMap.get(key), i)
            } else {
                // Mount new element
                // Create item is an edge case. It may happen during very fast scrolling
                const el = this.unusedPool.pop() || this.createItem()
                el.__key = key

                this.itemsContainer.appendChild(el)
                this.updateItemContent(el, item)
                this.translateElement(el, i)
                el.style.display = ''
                this.idDomMap.set(key, el)
            }
        }

        // Evict off-screen elements
        for (const el of this.unusedPool) {
            el.style.display = 'none'
        }
    }

    translateElement(itemEl, index) {
        itemEl.vsidx = index
        itemEl.style.transform = `translate3d(0, ${index * this.itemHeight + this.offsetTop}px, 0)`
    }
}
