# Feeding data into the editor (`loadGraph` / `loadLines`)

If your app renders blocks from its own data and then wires the lines, this is the supported shape. It
also explains the one error hosts hit most often:

```
Uncaught Error: NodeEditor: "1/onTimeout" is already connected to "2/i1"
    at NodeEditor.addConnectorFromTo
    at editorUtils.js:31   ← your forEach over page.conns
```

**Runnable, copy-pasteable fix:** [feeding-data.example.js](feeding-data.example.js) defines
`dedupeLines()` and `fillPage()` — a drop-in replacement for a host `editorFill` — and proves them
against the exact failing data (duplicates, a reversed twin, a corrupt entry, a second fill, and ports
that arrive asynchronously):

```sh
cd apps/nodditor && node doc/feeding-data.run.mjs   # or: bun run docs:feeding-data
```

## What the error means

It is not a false positive. The edge `"1/onTimeout" → "2/i1"` **already exists in the editor** when
your loop reaches that entry. `addConnectorFromTo` is the strict, single-line API, so it throws rather
than guessing what you meant.

The guard allows everything legitimate, so it only fires on a real duplicate:

| case | behaviour |
| --- | --- |
| one output → several different inputs (fan-out) | **allowed** — `1/o1→2/i1`, `1/o1→2/i2`, `1/o1→2/i3` all add |
| the same pair again, either direction | throws `already connected` |
| a different pair that merely shares an endpoint | **allowed** |
| an endpoint that does not exist in that block | throws `unknown connector: … discovered there: …` |
| a connector connected to itself | throws `cannot connect a connector to itself` |

So one of these is true of your data:

1. **`page.conns` contains the same entry twice** — an exact duplicate, or the same edge as
   `[a, b]` and `[b, a]`. (Reproduced: the second entry throws with exactly the message above.)
2. **The fill runs a second time** over an editor that already has those lines.

Note that a second run of the *whole* fill usually fails earlier, on `editor.add(...)`, with
`block id "1" is already in use` — if you are swallowing that error, the line loop is where you then
see the duplicate. Fix the re-run (below), not just the error.

## Fix 1 — use the tolerant loader (no throw, one line)

`loadLines` is the loader built for data-driven input: it attaches what it can, **reports and skips
what it cannot, and never throws**. It returns counts, so you can see the problem instead of crashing
on it.

```js
// editorUtils.js — replace the forEach + addConnectorFromTo
setTimeout(() => {
  const { attached, skipped } = editor.loadLines(page.conns)
  if (skipped) console.warn(`nodditor: ${attached} lines attached, ${skipped} skipped`)
}, 200)
```

Duplicate, unknown endpoint, self-connection — all skipped with a console report naming the entry and
the reason:

```
NodeEditor: skipping line ["1/onTimeout","2/i1"] — NodeEditor: "1/onTimeout" is already connected to "2/i1"
```

That alone stops the error. If you want the duplicates gone before they reach the editor, de-duplicate
first (Fix 2), and if the fill should be able to *run again*, make it authoritative (Fix 3).

### Or: `fillPage()` — all three fixes, callable on every value change

[feeding-data.example.js](feeding-data.example.js) has the whole thing as two functions you can paste.
`fillPage` adds only the blocks that are missing, inspects the rendered connectors, de-duplicates the
lines and then loads them:

```js
import { fillPage } from './editorUtils.js' // the two functions from the example

// safe to call on every setValue, however many times it runs
fillPage(editor, page, { make: block => makeBlock(block) })
// -> { added, connections: { attached, skipped }, droppedLines }
```

Pass `{ clear: true }` when the call is authoritative — the editor is emptied first, so blocks and
lines deleted on the server disappear locally too. Without it, the fill is additive and never disturbs
what is already on the canvas.

The example asserts all of this (`22/22 assertions passed`), including the failure it prevents: the
raw `forEach` throws on the duplicate and **the throw aborts the fill**, so the later valid edge is
lost (`1 of 2 lines` attached).

## Fix 2 — de-duplicate the data

Preserves fan-out: it removes repeats of the same pair, not different edges from the same output.

```js
const seen = new Set()
const conns = (page.conns ?? []).filter(([a, b]) => {
  const key = [a, b].sort().join('\u0000') // direction-insensitive: a->b and b->a are one edge
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
```

This is worth logging once: if it drops entries, your data (or the server payload) contains duplicates
and the editor was only the messenger.

## Fix 3 — make the fill authoritative (`loadGraph`)

The cleanest shape if the whole graph comes from the server: `loadGraph` **clears the editor first**,
so running it twice is harmless and no stale line can survive. It also inspects the rendered blocks
before wiring lines, which is what makes it safe when ports arrive with the data.

```js
// one call does blocks -> inspect -> lines, and can be repeated safely
editor.loadGraph({ blocks: page.blocks, lines: page.conns })
```

Requirements: every block `type` needs a factory in `typeMap`, and the factory **receives the block's
data** so it can render that block's markup:

```js
const typeMap = {
  Menu: ({ id, label }) => makeMenuBlock(id, label),
}
```

Bad line entries are skipped with a console report (same tolerance as `loadLines`), and it returns
nothing to check — watch the console once per release.

## Checking readiness before wiring

Ports that arrive asynchronously (your `setTimeout` note: "intents are getting async") are the other
half of this. Inspect first and wire second, and you do not need to guess a delay:

```js
editor.loadGraph({ blocks: page.blocks, lines: [] }) // 1. blocks only
// ...the intents arrive and the ports are rendered...
const found = editor.inspectConnectors() // 2. discover them (forced rescan)
console.log('connectors:', found.map(c => c.idFull))
editor.loadLines(page.conns) // 3. now wire the lines
```

`editor.getConnectors(blockId)` gives one block's `Map` when you want to validate a specific endpoint
before wiring, and `editor.explainConnectors(blockId)` says why a connector was not discovered
(`duplicate ncid` / `not collected by the last scan` / missing from the block element entirely).

## Quick self-check

```js
console.log('before fill:', editor.blocks.length, 'blocks', editor.lines.length, 'lines', editor.selectedBlocks?.length, 'selected')
```

If `blocks` is already non-zero before your first fill, you are filling an editor that already has a
graph — that is Fix 3's job, or a signal that `setEditorValue` ran twice for the same instance.
