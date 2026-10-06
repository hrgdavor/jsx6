# @jsx6/virtual-scroll

## Overview

A small, dependency-free virtual scrolling utility for lists of **fixed-height** rows.

- Renders only the rows intersecting the viewport (plus an optional buffer) by recycling a pool of DOM elements
- Rows are positioned with `translate3d`; row `i` sits at `i * itemHeight + offsetTop`
- Identity-aware reuse: a row is re-bound only when a new key enters the viewport; a row that stays mounted under the same key is repositioned, not re-bound
- No dependencies, and the whole library is **~1.2 KB gzipped** (3.3 KB minified)

**Fixed-height rows are a strict requirement of this library.** Variable-height rows are not supported.

Why it is built this way — the trade-offs behind each default, with measurements and examples — is in
[architecture.md](architecture.md).

## Install

```sh
bun add @jsx6/virtual-scroll    # or: npm i @jsx6/virtual-scroll
```

```js
import { VirtualScroll } from '@jsx6/virtual-scroll'
```

## Quick start

Four pieces: a scroller with a known height, a spacer that gives it the list's height, a container for
the rows, and the config. Everything the CSS has to do is in
[Required markup and CSS](#required-markup-and-css).

```html
<div id="scroller"><div id="spacer"></div><div id="rows"></div></div>
```

```css
#scroller { position: relative; height: 400px; overflow-y: auto }
#rows { position: absolute; top: 0; left: 0; width: 100% }
.vs-row { position: absolute; top: 0; left: 0; width: 100%; height: 32px }
```

[examples/minimal.js](./examples/minimal.js#region:minimal)

```js
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
```

That is the whole setup (plus the import above) — it is a real module, injected here so it cannot
drift, and it is verified in a browser: first frame rendered, viewport sized through
`getTotalHeight()`, band covered, scroll re-rendering, and `scrollToIndex`. For production wiring —
a scroll handler that cannot wedge when a render throws, debounced resize, `scrollToIndex` — copy a
controller from [Wiring](#wiring), and see [docs/](docs) for runnable demos.

## API

`new VirtualScroll(config)`

| config | type | description |
| --- | --- | --- |
| `itemsContainer` | `HTMLElement` | container element that holds the rows |
| `scroller` | `HTMLElement` | the element that actually scrolls — only needed for `scrollToIndex()`; the library never goes looking for it |
| `itemHeight` | `number` | fixed row height in px |
| `items` | `Array` | full array of data items |
| `buffer` | `number` (default `1`) | extra rows kept mounted above/below the viewport — see [Buffer and phasing](#buffer-and-phasing) |
| `offsetTop` | `number` (default `0`) | px offset of the list start (e.g. a header above the items) |
| `createItem` | `() => HTMLElement` | row factory |
| `updateItemContent` | `(el, item) => void` | binds data to a row |
| `getKey` | `(item) => string\|number` | unique item key (default `item.id`) |
| `onDuplicateKey` | `(key, item, index) => void` | called when a key repeats in the rendered range (default: `console.warn`) |
| `onItemPooled` | `(el) => void` | called when a bound row is parked in the pool, so you can release per-row state — see [Not `destroyItem`](#not-destroyitem) |
| `hiddenClass` | `string` | class toggled on pooled rows instead of the built-in hiding, so your CSS picks the mechanism — see [Hiding pooled rows](#hiding-pooled-rows) |

Methods:

- `updateViewport(containerHeight, scrollTop)` — stores the viewport height and renders. **Must be called before scrolling.**
- `render(scrollTop)` — recomputes the visible range and mounts/recycles rows for the stored viewport height.
- `refreshVisible()` — re-runs `updateItemContent` for the rows that are mounted right now, to push changed item data into them (it mounts and evicts nothing).
- `getTotalHeight()` — the content height the scroller needs: `items.length * itemHeight + offsetTop`.
- `getScrollTopForIndex(index)` — the offset that brings an item to the top, clamped to the list: `index * itemHeight + offsetTop`.
- `scrollToIndex(index)` — sets the scroller to that offset and renders the range for it (needs `scroller` — see [Jumping to an item](#jumping-to-an-item)).
- `destroy()` — removes all managed rows from the DOM and clears the pools.

`translateElement(el, index)` and `recycleElements(pending)` are exposed helpers, not intended surface.

## Buffer and phasing

A row is bound, laid out and painted when it mounts. Without a buffer, the row that becomes necessary
is mounted in the same task that noticed the scroll, and anything its content still needs — an image
decode, a lazy child, a font — lands a frame or more *after* it is already on screen. `buffer` keeps
extra rows mounted above and below the viewport so the rows on the way in have already been through
all of that by the time the scroll actually brings them into view. That is why the default is **1**
and not `0`: one row each way is a couple of extra nodes as insurance against content visibly phasing
in at the edge, and it gives async row content a head start. Set `buffer: 0` to keep exactly the rows
the viewport overlaps (the smallest DOM), or raise it for very fast scrolling or very tall rows — the
cost is one extra mounted (bound, laid out) row per buffer step per side.

## Jumping to an item

Row `i` lives at `i * itemHeight + offsetTop` in the scroller's *content*, so the offset and the
rendered range have to agree: a range rendered for an offset the scroller is not at is simply off
screen. Both steps are two lines of arithmetic, which is exactly what `scrollToIndex()` is:

```js
vs.scrollToIndex(500)
// same thing, if you would rather own the scroller yourself:
scroller.scrollTop = vs.getScrollTopForIndex(500)
vs.render(scroller.scrollTop)
```

`getScrollTopForIndex(index)` is `index * itemHeight + offsetTop`, clamped so the last rows can still
reach the top (an unclamped offset would leave them stranded below the fold). `scrollToIndex()` then
sets `scroller.scrollTop` and renders immediately for the offset the browser *reports* — it clamps and
rounds, and the range has to be the one it settled on — rather than waiting a frame for the scroll
event. It needs `scroller` in the config (the core never searches for it); without it, use the two
lines above, which is what the example controllers' `scrollToIndex(index)` does with the container
they already hold.

## Required markup and CSS

The library writes only `transform` (and, unless you set `hiddenClass`, `display`) on the rows, and
never measures anything — that is what keeps it small and testable without a browser. The geometry is
therefore your half of the contract, and it fails **silently** when a rule is missed:

| requirement | why |
| --- | --- |
| the scroller (not `itemsContainer`) is the scrolling box: known height + `overflow-y: auto` | you pass that height to `updateViewport(containerHeight, …)`; the library never reads the DOM |
| the scroller's content height is `items.length * itemHeight + offsetTop` — `getTotalHeight()` returns it; normally a spacer element (see `docs/style.css`) | the rows are moved with `transform` only, so they add no height of their own: without the spacer nothing scrolls, or the tail is unreachable |
| rows must not contribute to that height, in **either** of two ways — see below | `translate3d` moves a row relative to `itemsContainer`, so a row that also sits at its flowed position is offset twice and inflates the container |
| row content is clamped to `itemHeight` (`overflow: hidden`, ellipsis or a line clamp) | content that wraps makes the row taller than `itemHeight`, and every row below it drifts |
| `itemsContainer` itself contributes no height (`position: absolute; top: 0` in the demos) | it must not add to the scroller's content height |

Two row layouts satisfy that, and the library works with both because it only ever writes `transform`:

```css
/* 1 — absolutely positioned rows (simplest) */
.rows { position: absolute; top: 0; left: 0; width: 100% }
.row  { position: absolute; top: 0; left: 0; width: 100%; height: var(--item-height) }
```

```css
/* 2 — a grid stack: every row shares one grid area, nothing is positioned */
.rows { position: absolute; top: 0; left: 0; width: 100%; display: grid; grid-template-columns: var(--cols) }
.row  { grid-area: 1 / 1 / 2 / -1; display: grid; grid-template-columns: var(--cols); height: var(--item-height) }
```

Layout 2 is what makes table-like columns and a sticky header easy: the rows are ordinary grid items,
so they can use the container's column tracks, and nothing needs `position: absolute`. Two traps,
both measured:

- `grid-area: 1 / 1` is **not** enough once the container declares columns — it puts the row in the
  first column track only, so the row is as wide as that one track (with a `48px` first column, a
  row is 48px wide). It has to span them all: `grid-area: 1 / 1 / 2 / -1`.
- A bare `1fr` column has a content-based minimum, so one long cell widens that track for that row
  only and the columns drift apart. Use `minmax(0, 1fr)`, or `overflow: hidden` on the cell (which
  sets the min to 0 for that item).

`itemHeight` may be fractional (`26.5`): positions are derived from the index, so neighbouring rows
still share an exact edge — measured in a browser at `--force-device-scale-factor=1`, with the
viewport band covered edge to edge and no white seam between rows, in both layouts.

What this design deliberately does **not** do: real `<table>` markup (`position: absolute` on a
`<tr>` collapses the table — use grid/flex rows), wrapping or multi-line rows, masonry, and any
variable-height measurement.

## Table layout and sticky headers

With the [grid stack](#required-markup-and-css) a virtualized table is just: a column template shared
by a sticky header and the rows, and `offsetTop` set to the header's height so the row grid starts
below it at rest.

```html
<main id="scroller" style="--item-height: 40px">
  <div class="table-header"><span>#</span><span>Product</span><span>Price</span></div>
  <div id="spacer"></div>
  <div id="rows" class="table-rows"></div>
</main>
```

```css
:root { --table-cols: 48px minmax(0, 1fr) 88px }

.table-header {
  position: sticky; top: 0; z-index: 2;           /* stays at the top of the scrollport */
  display: grid; grid-template-columns: var(--table-cols);
  height: var(--item-height);
  background: var(--bg-color);                    /* opaque: rows scroll under it */
}

.table-rows { position: absolute; top: 0; left: 0; width: 100%; display: grid; grid-template-columns: var(--table-cols) }
.table-row  { grid-area: 1 / 1 / 2 / -1; display: grid; grid-template-columns: var(--table-cols); height: var(--item-height) }
```

```js
new VirtualScroll({
  // ...
  itemHeight: 40,
  offsetTop: header.offsetHeight, // the row grid starts below the sticky header
})
```

Measured in Blink (`docs/table-grid.html` is the runnable demo):

| check | result |
| --- | --- |
| rows are grid items, not positioned | `position: static`, all in `grid-area: 1 / 1 / 2 / -1` |
| row positions still exact | max error **0.000 px** at fractional and large scroll offsets |
| header/row columns align | header cells at `x = 0, 40, 256`, row cells at `0, 40, 256` |
| the header stays put | pinned to the scrollport top at every offset tested, rows passing under it |
| scroll extent unchanged | `scroller.scrollHeight === getTotalHeight()` (header height included) |

**Why the header is a plain sibling element.** The library never touches it, and it must not: because
every row shares one grid area, `position: sticky` on a *row* would apply to all of them at once, and
the row's own `transform` is then applied on top of the sticky offset — the rows would end up
positioned relative to the viewport instead of the content. One sticky header in the scroller, above
the rows, is the solution that works; it is also the one that needs no library support beyond
`offsetTop`.

**What is out of scope: per-section sticky headers.** A "current group" header that swaps as you
scroll through sections (the contacts-list pattern) needs to know which sections exist and where they
start. This library is a flat list of fixed-height rows and has no notion of groups, so that stays
with the host: render your own header element and update it from your scroll handler (`onScroll`),
using the index of the first visible row. It is a small amount of host code, and it keeps the library
from growing a grouping model it cannot generalize.

## Contract

- Item keys must be **unique**. A key that repeats within the rendered range is **ignored, not
  fatal**: the first occurrence is rendered, the later ones are skipped, and the duplicate is
  reported through `onDuplicateKey` (by default `console.warn`) — once per key while it stays
  duplicated, so scrolling does not repeat it. A skipped item leaves no row at its position, which
  makes the broken key extractor visible instead of quietly re-binding the wrong data. Fix the data;
  the list keeps working in the meantime.
- A throw from `createItem` or `updateItemContent` cannot orphan a row: every element handed to
  `itemsContainer` is either mounted or pooled, and `destroy()` reclaims all of them. A reporter that
  throws is recorded before it runs, so it cannot make the library report on every frame either.
- `updateItemContent` runs when a row (re)mounts. A row that stays mounted under the same key is
  **not re-bound**, so mutating item data is not reflected until that row cycles through the pool.
  `refreshVisible()` is the way to push changed data into the rows that are on screen right now.
- Rows that leave the viewport stay in the container for reuse and are hidden with `display: none`
  — see [Hiding pooled rows](#hiding-pooled-rows) for the alternative that keeps a row's layout, what
  it costs and how to take the CSS over. A recycled row is re-attached only when it is no longer a
  child of `itemsContainer`.

### Not `destroyItem`

There is no per-row destroy hook, because nothing is destroyed while the list lives: a row that
leaves the viewport is parked in the pool with its element, its listeners and its subtree intact, and
`updateItemContent` re-binds it when it comes back. `destroyItem(el)` would therefore be a misleading
name — the row is not going away. What a host actually needs is the moment the item leaves the
viewport, so that per-item state can be released before the element is reused for a different item:
that is `onItemPooled(el)`.

```js
const vs = new VirtualScroll({
  // ...config
  onItemPooled: el => {
    // release what updateItemContent set up for the item that just left
    subscriptions.get(el)?.()
    subscriptions.delete(el)
  },
})
```

It fires once per row, right after the row has been hidden and put in the pool (the element is already
`display: none`, so the hook sees no flash), and it is not a teardown: `destroy()` removes the rows and
calls no per-row hook. If the hook throws, the eviction still finishes — every row is parked, so
nothing can be orphaned — and the first error is rethrown. A row whose `updateItemContent` threw is
not reported through the hook: it was never bound, and the bind error is the one to act on.

## Hiding pooled rows

A row that leaves the viewport is kept in the container (that is the whole recycling idea), so it has
to be made invisible and non-interactive without being destroyed. Two things decide how, and they are
independent: **which CSS hides it**, and **who owns that CSS**.

### The mechanism: `display: none` (default) vs the layout-preserving pair

The default is `display: none`, written inline: the row leaves layout, paints nothing and takes no
clicks. The alternative — worth reading about even if you never switch — is `content-visibility: hidden`
**plus** `visibility: hidden`, which you opt into through [`hiddenClass`](#who-owns-the-css-hiddenclass).
Measured in Blink, on an absolutely positioned row with an opaque background, a border and a nested
element:

| mechanism | subtree layout | row's own box painted | hit-testable | focusable | toggle cost |
| --- | --- | --- | --- | --- | --- |
| `display: none` *(default)* | **discarded** (nested element `0x0`) | no | no | no | baseline |
| `content-visibility: hidden` alone | kept (`60x8`) | **yes** | **yes** | no | — |
| `content-visibility: hidden` + `visibility: hidden` | kept (`60x8`) | no | no | no | equal on the re-bind path |

So the pair is not "`display: none` but fancier", and `content-visibility` is not safe on its own:

- `content-visibility: hidden` alone skips the row's *contents* but keeps the row's own box, so a
  pooled row parked at a stale position (data shrank, list was filtered, items were reordered) would
  paint its background and border over live rows and swallow clicks aimed at them. That is why the
  pair needs `visibility` as well.
- `visibility` is also the half that survives on engines without `content-visibility`: the rows are
  still hidden correctly, you just lose the retained layout.

**What the retained layout is actually worth.** It is a real, measurable difference, but it only pays
off when a row comes back with its content *unchanged*. This library re-binds every row on mount
(`updateItemContent`), which invalidates exactly that cached layout, and in a hide→show→force-layout
benchmark the two mechanisms came out **equal** for that path (117 µs vs 117 µs per row-set at 30 rows
× 8 cells; 469 µs vs 507 µs at 60 × 24 — inside run-to-run spread). At 4× the subtree size *without*
re-binding, `display: none` was ~20 % faster to toggle. That is why `display: none` is the default:

- **`display: none`** *(default)* — the row leaves layout entirely: simplest, nothing to get wrong,
  and marginally cheaper when rows are cheap and fully re-bound, which is the common case.
- **the pair** — pooled rows keep their layout. Worth switching to when a row holds something
  expensive or stateful (canvas, video, iframe) or your `updateItemContent` patches only part of the
  row, so the rest of the subtree is still laid out when it comes back. Take it over with
  `hiddenClass` below.

### Who owns the CSS: `hiddenClass`

```js
new VirtualScroll({ itemsContainer, itemHeight, items, createItem, updateItemContent, hiddenClass: 'vs-pooled' })
```

With `hiddenClass` the library writes no hiding style of its own: it adds the class when a row is
pooled and removes it when the row is reused, and your stylesheet decides the mechanism — either of
the rows above, or anything else. (`transform` is still written inline, as always.)

```css
/* the default, now under your control */
.vs-pooled { display: none }

/* or: keep the row's layout (see the table above for what that does and does not buy) */
.vs-pooled { content-visibility: hidden; visibility: hidden }
```

Two things to know before choosing it:

- **Pooled rows are visible and clickable until you style the class.** The library deliberately does
  not inject CSS, so an unstyled `hiddenClass` breaks the list instead of hiding it. No inline hiding
  style is written either, precisely so your rules win without `!important` — which also makes the
  pool state visible in DevTools (`vs-pooled` on hidden rows) and lets you debug a seemingly blank
  list.
- It is read once, at construction.

### CSP

Nothing above needs CSP attention on the library's side: `element.style.x = …` and `classList` are
CSSOM/DOM writes, which `style-src` does not restrict. Measured under
`default-src 'none'; style-src 'none'`: CSSOM writes and a class styled from an `adoptedStyleSheets`
sheet both applied, while a style attribute parsed from markup, `setAttribute('style', …)` and an
injected `<style>` element were all blocked. So if you ever ship hiding CSS from code, use a real
stylesheet or `document.adoptedStyleSheets` — never `setAttribute('style', …)` and never an injected
`<style>`.

## Wiring

The core listens to nothing: you call `render(scrollTop)` on scroll and
`updateViewport(height, scrollTop)` on resize. Two ready-to-copy controllers live in `examples/` —
they are **snippets, not package surface**: `files` ships no `examples/` and the package declares no
runtime dependency, so nothing here depends on them.

Both own the scroller element, which is where anything that *moves* the scroller belongs: each adds
`scrollToIndex(index)`, i.e. `container.scrollTop = virtualScroll.getScrollTopForIndex(index)`. The
core keeps the math (and stays DOM-free); the controller touches the DOM.

Dependency-free (`scroll` + `ResizeObserver`):

[examples/scroll-controller.js](./examples/scroll-controller.js#region:controller)

```js
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
```

With the jsx6 stack, `@jsx6/dom-observer` shares one `ResizeObserver` for the whole page and its
first entry doubles as the initial measurement, so the debounce and the explicit `start()` go away:

[examples/scroll-controller-observer.js](./examples/scroll-controller-observer.js#region:observer-controller)

```js
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
```

## Structure

- [virtual-scroll.js](src/virtual-scroll.js) is the core
- [architecture.md](architecture.md) is the *why*: the trade-offs behind the defaults, with examples
- [examples/minimal.js](examples/minimal.js) is the quick start above,
  [scroll-controller.js](examples/scroll-controller.js) and
  [scroll-controller-observer.js](examples/scroll-controller-observer.js) are the wiring snippets —
  none of them ship in the package (`files` covers `index.js`, `src`, `dist`, `esm`, `cjs`)
- [docs/](docs) has three runnable demos:
  [index.html](docs/index.html) (plain list with recycled rows),
  [offset-top.html](docs/offset-top.html) (a header offset through `offsetTop`) and
  [table-grid.html](docs/table-grid.html) (grid rows in one cell under a sticky header, with
  `scrollToIndex` buttons)

## How to run

```shell
bun run build   # esbuild → esm/ (the demos import ../esm/index.js)
bunx vite docs  # then open /index.html, /offset-top.html or /table-grid.html
```
