# Architecture — why `@jsx6/virtual-scroll` is shaped this way

[README.md](README.md) is the *what and how*: API, required CSS, recipes. This file is the *why* — the
reasoning and the trade-offs, with examples — so you can judge whether the library fits before adopting
it. (There is a compact decision list for maintainers in
[architecture.agents.md](architecture.agents.md); keep the two in step when a decision changes.)

The whole library is [`src/virtual-scroll.js`](src/virtual-scroll.js) — about 370 lines, no
dependencies, ~1.2 KB gzipped. It writes `transform` and one hiding mechanism on rows, and never
measures anything.

## Fixed height is the feature, not the shortcut

Measuring rows is the expensive part of virtualization: it forces layout, needs re-measuring whenever
content changes, and invites scroll-anchor corrections. Because a row is exactly `itemHeight`, position
is `index * itemHeight + offsetTop` — pure arithmetic, no feedback loop, and it stays exact even with
fractional heights (measured: 0.000 px error with `26.5` px rows, and no seams at a half-pixel scroll
offset, which is where naive implementations drift).

The price is a contract: content is clamped to the row height, and the list is reachable only if the
scroller's content height is `items.length * itemHeight + offsetTop`. That is what `getTotalHeight()`
returns:

```js
document.getElementById('spacer').style.height = `${vs.getTotalHeight()}px`
```

What fixed height covers well: logs, tables, palettes, selects, file trees, uniform timelines. What it
cannot do: chat transcripts, wrapping rows, masonry.

## A row's life: bound, parked, re-bound

```js
// mounted: createItem() then updateItemContent(el, item) — the only place data is bound
// parked:  display: none (or your hiddenClass), pushed on the pool, kept in the container
// reused:  popped from the pool, re-bound through updateItemContent, positioned by transform
```

Two details matter more than they look:

- **Eviction happens before mounting.** The rows a frame gives up are the rows it hands out, which is
  what keeps a row's element stable while you scroll down and back up. Doing it the other way round
  (mount, then evict) creates fresh elements every frame — a test caught exactly that during
  development.
- **A row that stays mounted under the same key is never re-bound.** That is the cheap path, and it is
  also why changing item data does not reach the screen by itself — `refreshVisible()` is the explicit
  way to re-bind what is on screen:

```js
items[3].title = 'edited elsewhere' // the row for key 3 is mounted and does not know
vs.refreshVisible()                 // re-runs updateItemContent for the mounted rows
```

## Duplicates are a data smell, not a crash

Keys must be unique. When they are not, the first occurrence renders, the later ones are **skipped** —
their slot stays empty, so the bug is visible instead of quietly re-binding the wrong data — and the key
is reported once per episode:

```js
new VirtualScroll({
  /* … */
  onDuplicateKey: (key, item, index) => myLogger.warn('duplicate row key', key, index),
})
// default: console.warn('VirtualScroll: duplicate key 7 at index 12 (index 3 already used it) — …')
```

It used to throw, which was worse in three ways: the exception escaped the host's `requestAnimationFrame`
scroll handler and left its `ticking` flag set, so the list froze permanently; rows already on screen
stayed there untracked, unreclaimable by `destroy()`; and a duplicate is a data condition, not a
programmer error that deserves a crash. Reporting is deduplicated per key per episode, so scrolling
through a range with a bad key does not spam the console.

## A fault cannot corrupt the instance

```js
updateItemContent(el, item) {
  if (item.broken) throw new Error('bad data') // render() survives this
}
```

`render()` plans the frame's keys before touching the DOM, evicts in a `finally`, and returns a row to
the pool when its binder throws. The invariant you can rely on: **every element handed to
`itemsContainer` is either mounted or pooled**, so `destroy()` always reclaims all of them, and the
next render recovers from the pool. The same holds for a throwing `onItemPooled` or `onDuplicateKey`:
the frame finishes, the error surfaces once, and nothing leaks.

## Hiding pooled rows: why `display: none` is the default

Measured in Blink, on a positioned row with an opaque background, a border and a nested element:

| mechanism | subtree layout | row's own box painted | hit-testable |
| --- | --- | --- | --- |
| `display: none` | discarded (nested element `0x0`) | no | no |
| `content-visibility: hidden` | kept (`60x8`) | **yes** | **yes** |
| `content-visibility: hidden` + `visibility: hidden` | kept (`60x8`) | no | no |

So `content-visibility: hidden` *alone* is unsafe here: a pooled row parked at a stale position (data
shrank, list filtered, items reordered) would paint its background over live rows and swallow clicks
meant for them. The pair `content-visibility + visibility` is correct, and it keeps the row's layout —
but that buys nothing for a list that re-binds rows on the way in: hide→show→layout measured **equal**
to `display: none` (117 µs vs 117 µs per 30 rows × 8 cells; 469 vs 507 µs at 60×24), and ~20 % *slower*
at 4× the subtree size without a re-bind. Hence the simplest correct default, with an opt-out:

```js
new VirtualScroll({ /* … */ hiddenClass: 'vs-pooled' })
```
```css
.vs-pooled { display: none }                                   /* the default, now yours to change */
.vs-pooled { content-visibility: hidden; visibility: hidden }  /* keep the row's layout instead */
```

The class also makes the pool state visible in DevTools — useful when a list looks blank and you want to
know whether rows are parked or missing. It is opt-in because the library deliberately injects no CSS:
without your rule, pooled rows would stay visible and clickable.

## Buffer: one row each way, by default

A row is bound, laid out and painted when it mounts, so without a buffer the row that becomes necessary
is mounted in the same task that noticed the scroll, and anything its content still needs — an image
decode, a lazy child, a font — lands after it is already on screen. `buffer: 1` gives every row one row
of lead time, for one extra mounted row per side. This is a UX choice, not a measured win; `buffer: 0`
keeps the DOM to exactly the rows the viewport overlaps.

## There is no `destroyItem` — a row is parked, not destroyed

```js
// release per-item state where the item leaves the viewport, not where the element dies
onItemPooled: el => {
  subscriptions.get(el)?.()
  subscriptions.delete(el)
}
```

The element, its listeners and its subtree survive pooling and are re-bound to the next item, so a
"destroy" hook would misdescribe the lifecycle — and invite the bug of tearing down something that is
about to be reused. `onItemPooled` fires once per bound row, right after it has been parked (so the hook
never sees a flash), and `destroy()` is the only teardown, calling no per-row hook.

## Two row layouts — and the two grid traps

```css
/* 1 — absolutely positioned rows */
.row { position: absolute; top: 0; left: 0; width: 100%; height: var(--item-height) }

/* 2 — a grid stack: every row shares one grid area, nothing is positioned */
.rows { position: absolute; top: 0; left: 0; width: 100%; display: grid; grid-template-columns: var(--cols) }
.row  { grid-area: 1 / 1 / 2 / -1; display: grid; grid-template-columns: var(--cols); height: var(--item-height) }
```

Both work, because the library only writes `transform`. Layout 2 is what makes table-like columns
possible without a `<table>` — and both traps below were found the hard way (a 216 px column
misalignment, and rows that were 48 px wide instead of full width):

- `grid-area: 1 / 1` puts a row in the **first column track only**. It must span them all:
  `grid-area: 1 / 1 / 2 / -1`.
- a bare `1fr` has a content-based minimum, so one long cell widens that track for that row alone and the
  columns drift away from the header. Use `minmax(0, 1fr)`, or `overflow: hidden` on the cell.

## Sticky headers: a sibling element, not a row

```html
<div class="table-header">…</div><!-- position: sticky; top: 0; z-index: 2; opaque background -->
<div id="spacer"></div>
<div id="rows" class="table-rows"></div>
```
```js
new VirtualScroll({ /* … */ offsetTop: header.offsetHeight }) // rows start below it at rest
```

Because all rows share one grid area, `position: sticky` on a *row* would apply to every row at once, and
the row's own `transform` is then applied on top of the sticky offset — the rows would end up positioned
relative to the viewport instead of the content. One sticky header above the rows needs no library
support: its flow space is exactly what `offsetTop` describes, and `getTotalHeight()` already includes
it. The full recipe is in the README, and [docs/table-grid.html](docs/table-grid.html) is the running
demo (header pinned while rows pass underneath, columns aligned to the row grid).

Per-section ("current group") headers are out of scope: they need to know which groups exist and where
they start, and this is a flat list. Host code in your `onScroll` is the better fit.

## Jumping to an item

```js
vs.scrollToIndex(500) // needs `scroller` in the config
// …or the same two lines with the element you already hold:
scroller.scrollTop = vs.getScrollTopForIndex(500)
vs.render(scroller.scrollTop)
```

The offset has to match the rendered range: row `i` lives at `i * itemHeight + offsetTop` in the
scroller's *content*, so a range rendered for a different offset is simply off screen. `scrollToIndex()`
sets the offset, reads back what the browser settled on (it clamps and rounds, and the range has to
follow), and renders that range immediately instead of waiting a frame for the scroll event.
`getScrollTopForIndex()` clamps so the last rows can still reach the top instead of stopping short.

## Not supported, and why

| not supported | why |
| --- | --- |
| variable-height rows | it is the whole design: position = index × height, no measurement loop |
| real `<table>` markup | `position: absolute` on a `<tr>` collapses the table; use grid/flex rows |
| per-section sticky headers | needs a grouping model; host code with `onScroll` fits better |
| masonry, horizontal virtualization | separate layout problems, not this library's contract |
| wrapping / multi-line rows | they break the fixed-height contract, which fails silently |
| accessibility work | skipped for this release; rows are plain DOM, so `role` / `aria-setsize` / `aria-posinset` are yours to add |
