/**
 * Hide a pooled row.
 *
 * The default is `display: none`: the row leaves layout, paints nothing and takes no clicks — the
 * simplest thing that is also impossible to get wrong. Its cost is that the subtree's layout and
 * paint state are discarded, so a returning row is laid out from scratch; for a list that re-binds
 * every row on mount (`updateItemContent`) that is close to a wash anyway.
 *
 * The alternative, for rows holding something expensive or stateful (canvas, video, iframe) or when
 * `updateItemContent` patches only part of a row, is `content-visibility: hidden` **plus**
 * `visibility: hidden`. `content-visibility` keeps the subtree's layout, but on its own it only skips
 * the *contents*: the row's own box stays painted and stays hit-testable, so a pooled row parked at a
 * stale position would paint over live rows and swallow clicks meant for them — `visibility` hides
 * that box as well. Opt into it with `hiddenClass` and your own CSS; the README compares the two.
 *
 * @param {HTMLElement} el
 * @param {string} [hiddenClass]
 */
const hideRow = (el, hiddenClass) => {
  if (hiddenClass) {
    el.classList.add(hiddenClass)
    return
  }
  el.style.display = 'none'
}

/**
 * Hand a row back to the visible list.
 * @param {HTMLElement} el
 * @param {string} [hiddenClass]
 */
const showRow = (el, hiddenClass) => {
  if (hiddenClass) {
    el.classList.remove(hiddenClass)
    return
  }
  el.style.display = ''
}

/**
 * @typedef {Object} VirtualScrollConfig
 * @property {HTMLElement} itemsContainer - The DOM element that holds the list items.
 * @property {HTMLElement} [scroller] - The element that actually scrolls (its `scrollTop` is the
 *   position the range is computed for). Only needed for `scrollToIndex()`; the library never goes
 *   looking for it.
 * @property {number} itemHeight - The fixed height of each row in pixels. Rows MUST have this
 *   fixed height; variable-height rows are not supported.
 * @property {Array<any>} items - The full array of data items to render.
 * @property {number} [buffer=1] - Number of extra rows kept mounted above and below the viewport.
 *   One row each way means a row that is about to enter is already bound, laid out and painted when
 *   it does, which is what makes rows phase in smoothly instead of appearing at the edge (most
 *   visible on fast scrolling and with async content such as images). `0` keeps the mounted set to
 *   exactly what the viewport overlaps.
 * @property {number} [offsetTop=0] - Vertical offset of the list start in pixels (e.g. a header
 *   above the items). Row i is placed at `i * itemHeight + offsetTop`.
 * @property {() => HTMLElement} createItem - Factory function to create a new list item DOM element.
 * @property {(el: HTMLElement, item: any) => void} updateItemContent - Function to bind data to a
 *   recycled DOM element. Called when a row (re)mounts; a row that stays mounted under the same key
 *   is repositioned but NOT re-bound.
 * @property {(item: any) => string|number} [getKey] - Function to get a unique identifier for an
 *   item. Defaults to item.id. Keys must be unique: a key that repeats within the rendered range is
 *   ignored (see `onDuplicateKey`).
 * @property {(key: any, item: any, index: number) => void} [onDuplicateKey] - Called when a key
 *   repeats within the rendered range. The first occurrence is rendered, the later ones are skipped
 *   and reported once per key while that key stays duplicated. Defaults to `console.warn`.
 * @property {(el: HTMLElement) => void} [onItemPooled] - Called when a bound row is moved into the
 *   pool, i.e. when its item leaves the viewport, right after the row has been parked (hidden and
 *   pooled). This is the hook for releasing per-row state: subscriptions, timers, media. It is
 *   **not** a destroy hook — the row still exists, stays in the container and will be reused, so
 *   there is deliberately no `destroyItem`: nothing is destroyed, and `updateItemContent` re-binds
 *   the row when it comes back. `destroy()` is the teardown and calls no per-row hook. A throwing
 *   hook cannot orphan a row (the eviction finishes first) and its first error is rethrown.
 * @property {string} [hiddenClass] - Class to toggle on rows that leave the viewport, instead of the
 *   default inline `display: none`. Set it to own the hiding CSS: the class is added when a row is
 *   pooled and removed when it is reused, and no hiding style is written inline, so your stylesheet
 *   picks the mechanism — `display: none` again, or the layout-preserving
 *   `content-visibility: hidden; visibility: hidden` pair (the README explains what each buys, and
 *   why the pair needs both properties). Without CSS for that class the pooled rows stay visible and
 *   clickable.
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
 * - Item keys must be unique. A duplicate within the rendered range is ignored — the first
 *   occurrence is rendered and the later ones are skipped — and reported (`onDuplicateKey`,
 *   `console.warn` by default). Skipped items leave no row at their position, so a fix is visible.
 * - Rows that leave the viewport are kept in the container for reuse and hidden with `display: none`
 *   by default, or with the class named by `hiddenClass` when you would rather own that CSS — see
 *   [Hiding pooled rows](README.md#hiding-pooled-rows) for the alternative that keeps a row's layout
 *   and what it costs. A recycled row is re-attached only when it is no longer a child of
 *   `itemsContainer`.
 * - `render()` is atomic with respect to faults: a throw from a caller-supplied callback cannot
 *   orphan a row. Every element handed to `itemsContainer` is either mounted (`idDomMap`) or
 *   recycled (`unusedPool`), so `destroy()` always reclaims all of them.
 */
export class VirtualScroll {
  /**
   * @param {VirtualScrollConfig} config
   */
  constructor(config) {
    this.itemsContainer = config.itemsContainer
    this.scroller = config.scroller
    this.itemHeight = config.itemHeight
    this.items = config.items
    this.buffer = config.buffer ?? 1
    this.offsetTop = config.offsetTop || 0

    this.createItem = config.createItem
    this.updateItemContent = config.updateItemContent

    this.getKey = config.getKey || (item => item.id)
    this.onDuplicateKey = config.onDuplicateKey
    this.onItemPooled = config.onItemPooled

    // When set, hiding a pooled row toggles this class instead of writing inline styles
    this.hiddenClass = config.hiddenClass

    // domPool: Map<key, HTMLElement> — currently rendered elements
    this.idDomMap = new Map()
    // unusedPool: Array<HTMLElement> — recycled elements ready for reuse (kept in the DOM, hidden)
    this.unusedPool = []
    // reportedDuplicateKeys: Map<key, frame> — duplicates already reported in the current frame,
    // dropped again in the first frame the key stops repeating
    this.reportedDuplicateKeys = new Map()
    this.renderFrame = 0

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
   *
   * A key that repeats within the rendered range is ignored: the first occurrence is rendered, the
   * later ones are skipped (no row is mounted at their position) and reported through
   * `onDuplicateKey` — once per key while it stays duplicated, so scrolling does not repeat it.
   *
   * @param {number} scrollTop
   * @throws {Error} only what `createItem` / `updateItemContent` / `onDuplicateKey` throw.
   */
  render(scrollTop) {
    if (this.containerHeight < 0) return

    const start = Math.max(0, Math.floor((scrollTop - this.offsetTop) / this.itemHeight) - this.buffer)
    const end = Math.min(
      this.items.length,
      Math.ceil((scrollTop + this.containerHeight - this.offsetTop) / this.itemHeight) + this.buffer,
    )
    const frame = ++this.renderFrame

    const oldDomMap = this.idDomMap
    const idDomMap = new Map()
    this.idDomMap = idDomMap
    try {
      // 1. Claim the rows that stay mounted: they keep their element and are repositioned here,
      //    which also places each of them at *its own* index — the marker step 3 uses to tell a
      //    claimed key from a repeated one.
      for (let i = start; i < end; i++) {
        const key = this.getKey(this.items[i])
        const el = oldDomMap.get(key)
        if (!el) continue

        oldDomMap.delete(key)
        idDomMap.set(key, el)
        this.translateElement(el, i)
      }

      // 2. Recycle what left the viewport *before* mounting, so this frame reuses the rows the
      //    previous frame gave up (element identity stays stable while scrolling back and forth).
      this.recycleElements(oldDomMap)

      // 3. Mount what is missing. A key that is already mapped belongs to an earlier index: it is
      //    either a row claimed in step 1 or a duplicate. The element sits at its own index, so any
      //    other index is a repeated key — ignore it (its slot stays empty) and report it.
      for (let i = start; i < end; i++) {
        const item = this.items[i]
        const key = this.getKey(item)
        const claimed = idDomMap.get(key)
        if (claimed) {
          if (claimed.__vsIndex !== i) this.reportDuplicate(key, item, i, claimed.__vsIndex, frame)
          continue
        }

        const el = this.unusedPool.pop() || this.createItem()

        // Pooled rows are still in the container (hidden): re-appending them would be a needless
        // DOM mutation, so only a fresh — or externally detached — row is attached here.
        if (el.parentNode !== this.itemsContainer) this.itemsContainer.appendChild(el)
        idDomMap.set(key, el)
        try {
          this.updateItemContent(el, item)
        } catch (err) {
          // A throwing binder must not orphan the row: untrack it, hide it, recycle it. The host's
          // pool hook is not called here — the row was never bound, so there is no per-row state of
          // ours to release, and the bind error is the one worth surfacing.
          idDomMap.delete(key)
          hideRow(el, this.hiddenClass)
          this.unusedPool.push(el)
          throw err
        }
        this.translateElement(el, i)
        showRow(el, this.hiddenClass)
      }
    } finally {
      // Nothing may stay unreferenced, whatever threw above (clearing makes the second call a
      // no-op when the mount loop completed).
      this.recycleElements(oldDomMap)
      // Forget keys that were not duplicated in this frame, so a later repeat is reported again.
      if (this.reportedDuplicateKeys.size) {
        for (const [key, seen] of this.reportedDuplicateKeys)
          if (seen !== frame) this.reportedDuplicateKeys.delete(key)
      }
    }
  }

  /**
   * Report a key that repeats within the rendered range, once per key while it stays duplicated.
   *
   * The stamp is refreshed on every frame the key repeats and the reporter is called only the first
   * time, so scrolling does not repeat it. It is stamped *before* the reporter runs, so a throwing
   * reporter cannot make the library report on every frame either; the stamp is dropped in the first
   * frame the key stops repeating, which is what makes a later repeat visible again.
   *
   * @param {any} key
   * @param {any} item - the ignored item
   * @param {number} index - its index
   * @param {number} first - the index whose item already uses the key
   * @param {number} frame - the frame this render is
   */
  reportDuplicate(key, item, index, first, frame) {
    const alreadyReported = this.reportedDuplicateKeys.has(key)
    this.reportedDuplicateKeys.set(key, frame)
    if (alreadyReported) return

    if (this.onDuplicateKey) this.onDuplicateKey(key, item, index)
    else {
      console.warn(
        `VirtualScroll: duplicate key ${String(key)} at index ${index} (index ${first} already used it) — ` +
          `the item is not rendered, item keys must be unique`,
      )
    }
  }

  /**
   * Hide and recycle every element left in `pending`, exactly once, telling `onItemPooled` about each.
   *
   * Each entry leaves `pending` *before* its hook runs, and a throwing hook is collected instead of
   * stopping the loop: the eviction always finishes, so no row can be left unreferenced (which would
   * orphan it — `destroy()` could no longer reclaim it). The first hook error is rethrown afterwards.
   *
   * @param {Map<any, HTMLElement>} pending
   */
  recycleElements(pending) {
    if (pending.size === 0) return
    /** @type {unknown} */
    let failure
    for (const [key, el] of pending) {
      pending.delete(key)
      hideRow(el, this.hiddenClass)
      this.unusedPool.push(el)
      if (this.onItemPooled) {
        try {
          this.onItemPooled(el)
        } catch (err) {
          if (!failure) failure = err
        }
      }
    }
    if (failure) throw failure
  }

  /**
   * Re-run `updateItemContent` for every mounted row — the way to push changed item data into rows
   * that are already on screen. Rows are otherwise only bound when they mount, so a bulk change
   * (select all, an external edit, a sync) would not reach them.
   */
  refreshVisible() {
    for (const el of this.idDomMap.values()) {
      const item = this.items[el.__vsIndex]
      if (item !== undefined) this.updateItemContent(el, item)
    }
  }

  /**
   * The scroller content height the list needs: `items.length * itemHeight + offsetTop`. Size your
   * scroller (normally a spacer element) with it — rows are absolutely positioned and contribute no
   * height of their own.
   * @returns {number}
   */
  getTotalHeight() {
    return this.items.length * this.itemHeight + this.offsetTop
  }

  /**
   * The `scrollTop` that brings item `index` to the top of the viewport, clamped to the list so it
   * never scrolls past the end (which would leave the last rows parked away from the top). This is
   * the whole scroll-to-item math: `index * itemHeight + offsetTop`. Assign it to your scroller, or
   * let `scrollToIndex()` do both steps.
   * @param {number} index
   * @returns {number}
   */
  getScrollTopForIndex(index) {
    const last = Math.max(0, this.items.length - 1)
    const wanted = Math.min(Math.max(0, index), last) * this.itemHeight + this.offsetTop
    if (this.containerHeight < 0) return wanted // no viewport measured yet: nothing to clamp against
    return Math.max(0, Math.min(wanted, this.getTotalHeight() - this.containerHeight))
  }

  /**
   * Bring item `index` into view: set the scroller's offset (which has to match — row `i` lives at
   * `i * itemHeight + offsetTop` in the scroller's content, so a range rendered for a different
   * offset than the scroller is at is simply off screen), then render that range right away instead
   * of waiting for the scroll event.
   *
   * Needs `scroller` in the config. Without it, do the same two lines yourself:
   * `container.scrollTop = vs.getScrollTopForIndex(index)` — the example controllers do that.
   *
   * @param {number} index
   * @throws {Error} when no `scroller` was configured.
   */
  scrollToIndex(index) {
    if (!this.scroller) {
      throw new Error(
        'VirtualScroll: scrollToIndex() needs `scroller` in the config — or set container.scrollTop = ' +
          'getScrollTopForIndex(index) yourself',
      )
    }
    this.scroller.scrollTop = this.getScrollTopForIndex(index)
    // read back: the browser clamps and rounds, and the range has to be the one it settled on
    this.render(this.scroller.scrollTop)
  }

  translateElement(itemEl, index) {
    itemEl.__vsIndex = index
    itemEl.style.transform = `translate3d(0, ${index * this.itemHeight + this.offsetTop}px, 0)`
  }

  /**
   * Remove all managed rows from the DOM and clear the pools. This is the teardown: it does not call
   * `onItemPooled`, because the rows are gone rather than parked.
   */
  destroy() {
    for (const el of this.idDomMap.values()) el.remove()
    for (const el of this.unusedPool) el.remove()
    this.idDomMap.clear()
    this.unusedPool.length = 0
    this.reportedDuplicateKeys.clear()
    this.containerHeight = -1
  }
}
