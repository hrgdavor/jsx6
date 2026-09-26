/**
 * @typedef {Object} VirtualScrollConfig
 * @property {HTMLElement} itemsContainer - The DOM element that holds the list items.
 * @property {number} itemHeight - The fixed height of each row in pixels. Rows MUST have this
 *   fixed height; variable-height rows are not supported.
 * @property {Array<any>} items - The full array of data items to render.
 * @property {number} [buffer=0] - Number of items to render above/below the viewport.
 * @property {number} [offsetTop=0] - Vertical offset of the list start in pixels (e.g. a header
 *   above the items). Row i is placed at `i * itemHeight + offsetTop`.
 * @property {() => HTMLElement} createItem - Factory function to create a new list item DOM element.
 * @property {(HTMLElement, any) => void} updateItemContent - Function to bind data to a recycled
 *   DOM element. Called when a row (re)mounts; a row that stays mounted under the same key is
 *   repositioned but NOT re-bound.
 * @property {(any) => string|number} [getKey] - Function to get a unique identifier for an item.
 *   Keys must be unique across `items`; a duplicate key in the visible range throws. Defaults
 *   to item.id.
 */

/**
 * VirtualScroll class encapsulates the logic for high-performance scrolling
 * of large, fixed-height lists by recycling a pool of DOM elements using
 * identity-aware reconciliation.
 *
 * Contract:
 * - Call `updateViewport(containerHeight, scrollTop)` before scrolling: it stores the viewport
 *   height and performs the first render. `render(scrollTop)` then recomputes the visible
 *   range for the stored viewport height.
 * - Item keys must be unique.
 * - Rows that leave the viewport are hidden (`display: none`) but kept in the DOM for reuse.
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
    // unusedPool: Array<HTMLElement> — recycled elements ready for reuse (kept in the DOM, hidden)
    this.unusedPool = []

    // Viewport height; set by updateViewport() before render() (-1 = not yet set)
    this.containerHeight = -1
  }

  /**
   * Store the viewport height and render the visible range.
   * @param {number} containerHeight
   * @param {number} scrollTop
   */
  updateViewport(containerHeight, scrollTop) {
    this.containerHeight = containerHeight
    this.render(scrollTop)
  }

  /**
   * Single unified update: evict off-screen, mount on-screen.
   * Requires `updateViewport()` to have been called first.
   * @param {number} scrollTop
   */
  render(scrollTop) {
    if (this.containerHeight < 0) return

    const start = Math.max(0, Math.floor((scrollTop - this.offsetTop) / this.itemHeight) - this.buffer)
    const end = Math.min(
      this.items.length,
      Math.ceil((scrollTop + this.containerHeight - this.offsetTop) / this.itemHeight) + this.buffer,
    )

    // Process visible range
    const oldDomMap = this.idDomMap
    this.idDomMap = new Map()
    const seenKeys = new Set()
    for (let i = start; i < end; i++) {
      const item = this.items[i]
      const key = this.getKey(item)
      if (seenKeys.has(key)) {
        throw new Error(`VirtualScroll: duplicate key "${String(key)}" — item keys must be unique`)
      }
      seenKeys.add(key)

      const el = oldDomMap.get(key)
      if (!el) continue

      oldDomMap.delete(key)
      this.idDomMap.set(key, el)
    }
    for (const value of oldDomMap.values()) {
      value.style.display = 'none'
      this.unusedPool.push(value)
    }

    for (let i = start; i < end; i++) {
      const item = this.items[i]
      const key = this.getKey(item)

      if (this.idDomMap.has(key)) {
        // Already mounted — just update position
        this.translateElement(this.idDomMap.get(key), i)
      } else {
        // Mount new element (from the pool, or freshly created when the pool is empty)
        const el = this.unusedPool.pop() || this.createItem()

        this.itemsContainer.appendChild(el)
        this.updateItemContent(el, item)
        this.translateElement(el, i)
        el.style.display = ''
        this.idDomMap.set(key, el)
      }
    }
  }

  translateElement(itemEl, index) {
    itemEl.__vsIndex = index
    itemEl.style.transform = `translate3d(0, ${index * this.itemHeight + this.offsetTop}px, 0)`
  }

  /**
   * Remove all managed elements from the DOM and clear the pools.
   */
  destroy() {
    for (const el of this.idDomMap.values()) el.remove()
    for (const el of this.unusedPool) el.remove()
    this.idDomMap.clear()
    this.unusedPool.length = 0
    this.containerHeight = -1
  }
}
