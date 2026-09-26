## Overview

A small, dependency-free virtual scrolling utility for lists of **fixed-height** rows.

- Renders only the rows intersecting the viewport (plus an optional buffer) by recycling a pool of DOM elements
- Rows are positioned with `translate3d`; row `i` sits at `i * itemHeight + offsetTop`
- Identity-aware reuse: a row is re-bound only when a new key enters the viewport; a row that stays mounted under the same key is repositioned, not re-bound

**Fixed-height rows are a strict requirement of this library.** Variable-height rows are not supported.

## API

`new VirtualScroll(config)`

| config | type | description |
| --- | --- | --- |
| `itemsContainer` | `HTMLElement` | container element that holds the rows |
| `itemHeight` | `number` | fixed row height in px |
| `items` | `Array` | full array of data items |
| `buffer` | `number` (default `0`) | extra rows kept mounted above/below the viewport |
| `offsetTop` | `number` (default `0`) | px offset of the list start (e.g. a header above the items) |
| `createItem` | `() => HTMLElement` | row factory |
| `updateItemContent` | `(el, item) => void` | binds data to a row |
| `getKey` | `(item) => string\|number` | unique item key (default `item.id`) |

Methods:

- `updateViewport(containerHeight, scrollTop)` — stores the viewport height and renders. **Must be called before scrolling.**
- `render(scrollTop)` — recomputes the visible range and mounts/recycles rows for the stored viewport height.
- `destroy()` — removes all managed rows from the DOM and clears the pools.

### Contract

- Item keys must be **unique**; a duplicate key in the visible range throws.
- `updateItemContent` runs when a row (re)mounts. A row that stays mounted under the same key is **not re-bound**, so mutating item data is not reflected until that row cycles through the pool.
- Rows that leave the viewport are hidden (`display: none`) but kept in the DOM for reuse.

## Structure

- [virtual-scroll.js](src/virtual-scroll.js) is the core
- [scroll-controller.js](examples/scroll-controller.js) is an example that makes it work (wires `scroll` + `ResizeObserver`; call its `destroy()` when tearing down)
- [docs/](docs) is a demo plus an example of usage

## How to run

Run:
```shell
npm run build
vite docs
```
