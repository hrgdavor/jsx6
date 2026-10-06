# `@jsx6/virtual-scroll` — agent notes (compact)

Decisions, constraints and evidence for this package, in the form an agent needs: terse, no examples.
The user-facing twin is [architecture.md](architecture.md) — read it when maintaining parity between
the two, or when a decision here needs re-justifying. Tests pin behaviour, not prose.

**Orientation.** [`src/virtual-scroll.js`](src/virtual-scroll.js) (~370 lines, no deps) is a pure
function of `(containerHeight, scrollTop)` plus a key→element map: plan the range, claim the rows that
stay, park the ones that left, mount what is missing. It writes `transform` and one hiding mechanism on
rows and never measures anything. It never owns the scroller (except the optional `scroller` config
used by `scrollToIndex`) and never removes a row while the list lives. Geometry — fixed row height,
positioning (absolute **or** grid stack), the spacer giving the scroller its height — is the host's
half of the contract and fails silently when missed.

**Release state.** `1.0.0`, unpublished (npm 404). Publish verified **from a clean state**: with
`dist/`, `esm/`, `cjs/` deleted (gitignored build outputs) the publish flow builds all three, runs the
gate with `--require-built`, packs 12 files (no `examples/`, no `docs/`, no tests). `bun run check`
green.

## Decisions (do not reverse without re-measuring)

| decision | why | pinned by |
| --- | --- | --- |
| duplicate keys ignored and reported, never thrown | a throw escaped the host's rAF handler, wedged the loop permanently, and orphaned already-mounted rows | `test/faults.test.js` |
| `display: none` is the default hiding; `hiddenClass` hands the mechanism to the host | `content-visibility: hidden` alone leaves the row's own box painted **and** hit-testable; the layout-preserving pair measures no faster on the re-bind path (117 vs 117 µs at 30×8; 469 vs 507 at 60×24) and ~20 % slower at 4× subtree without a re-bind | `test/geometry.test.js` |
| `buffer` defaults to 1 | rows are bound/laid out/painted on mount; one row each way gives the entering row lead time. UX choice, not a measured win | `test/api.test.js` |
| no `destroyItem`; `onItemPooled(el)` | pooled rows are reused, not destroyed — the name would lie. Hook fires once per bound row after parking; `destroy()` calls no per-row hook | `test/api.test.js` |
| `scrollToIndex(index)` needs `scroller` in the config | the offset must match the rendered range (row `i` is at `i * itemHeight + offsetTop`); the core must not search the DOM | `test/api.test.js` |
| rows need not be absolutely positioned | only `transform` is written, so a grid stack works — that is what enables table columns | `test/geometry.test.js` |
| one sticky header (a sibling element), no per-section headers | all rows share one grid area, so per-row `position: sticky` cannot be correct | browser probe |
| `render()` never orphans a row | plan keys before DOM work, evict before mounting, recycle in a `finally` | `test/faults.test.js` |

**Do not:** throw or per-frame-log on duplicate keys · force `position: absolute` on rows · use
`content-visibility: hidden` without `visibility: hidden` · add a per-row destroy hook · make the core
read the DOM or guess the scroller (no `parentElement` lookups) · grow variable heights, grouping,
per-section headers, or `<table>` support.

**Grid-stack traps** (measured): `grid-area: 1 / 1` puts a row in the *first column track only* — a row
must span all of them (`grid-area: 1 / 1 / 2 / -1`); a bare `1fr` has a content-based minimum that
widens that track for that row alone (use `minmax(0, 1fr)`).

## Evidence inventory

| area | where |
| --- | --- |
| range math: 12,600 placements, 5 item heights (incl. fractional), both list edges, overscroll | `test/geometry.test.js` |
| duplicates, faults, failed-frame atomicity | `test/faults.test.js` |
| buffer, `refreshVisible`, `getTotalHeight`, `getScrollTopForIndex`, `scrollToIndex`, `onItemPooled`, empty list, destroyed instance | `test/api.test.js` |
| pool identity/reuse, hide mechanism, `destroy()` | `test/geometry.test.js`, `test/virtual-scroll.test.js` |
| real layout and paint (Blink probes, pixel-decoded): geometry 30/30, hide 7/7 in both modes, grid+sticky 8/8, `scrollToIndex` 6/6, observer wiring 4/4, README quick start 6/6 | probe pages under `.tmp/vs-browser/` — method in the root `AGENTS.md` |

**Other files here:** [README.md](README.md) (user-facing API/CSS/recipes, injected snippets),
[architecture.md](architecture.md) (the long-form why), `examples/` (snippets + the injected quick
start, not shipped), `docs/` (three demos, not shipped).
