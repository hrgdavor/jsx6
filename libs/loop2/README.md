# @jsx6/loop2 — keyed list rendering (Loop v2)

`Loop2` renders an array of data as a list of items and **moves the existing item instances** when the
array is reordered, so component state, focus, scroll position, event bindings and animations follow
the entry they belong to — the behaviour React and Solid users expect from a keyed list.

It is a **separate package on purpose**. `@jsx6/jsx6`'s `Loop` and `@jsx6/w`'s `jsx6-loop` custom
element keep working exactly as they do today; `@jsx6/loop2` is where the design fixes land. The
inventory of both implementations, the design decisions and the phased adoption plan live in
[plan/loop2-plan.md](../../plan/loop2-plan.md).

```sh
bun add @jsx6/loop2        # or: npm i @jsx6/loop2
```

> **Status:** new package (P0 of the plan), not published yet. Inside this repository depend on it as
> `"@jsx6/loop2": "workspace:*"`; outside it, wait for the first release (`bun run bump --pkg
> @jsx6/loop2 1.0.0` then `bun pub libs/loop2`).

```js
import { Loop2 } from '@jsx6/loop2'
import { h } from '@jsx6/jsx6'

const Row = ({ value }) => h('LI', null, value.name)

const loop = new Loop2({ item: Row, keyBy: row => row.id })
div.appendChild(loop.el)
loop.setValue([{ id: 1, name: 'ada' }, { id: 2, name: 'bob' }])
```

Inside a jsx6 template the `p` attribute puts the loop on the scope, exactly like `Loop`:

```js
const $rows = signal([{ id: 1, name: 'ada' }, { id: 2, name: 'bob' }])

div = (
  <div>
    <Loop2 item={Row} keyBy={r => r.id} value={$rows} p="rows" />
  </div>
)
// scope.rows is the Loop2 instance
```

`keyBy` is optional: without it `Loop2` uses the same `key={...}` / `$key` / `loopKey` mechanism
`@jsx6/jsx6` already writes for JSX keys, so existing item templates keep working unchanged.

---

## What Loop2 does differently

|                                                      | `@jsx6/jsx6` `Loop`                           | `@jsx6/w` `jsx6-loop`        | **`@jsx6/loop2` `Loop2`**                    |
| ---------------------------------------------------- | --------------------------------------------- | ---------------------------- | -------------------------------------------- |
| host                                                 | plain object with an anchor text node (`el`)  | `HTMLElement` custom element | plain object with an anchor text node (`el`) |
| keyed matching                                       | yes (`$key` / template `key`)                 | no (index only)              | yes, plus `keyBy`                            |
| explicit key extractor                               | —                                             | —                            | **`keyBy(data, i)`**                         |
| keyed primitives                                     | —                                             | —                            | **yes, with `keyBy`**                        |
| fresh datum objects matchable by key                 | only with `$key` on the data                  | —                            | **yes (`keyBy`)**                            |
| mutation paths                                       | four hand-written paths                       | three                        | **one matching pass for all**                |
| bounded reuse pool                                   | — (keeps every item ever built)               | —                            | **`maxPooled` / `releasePool()`**            |
| teardown (`disposeItem` / `dispose` / `disposeNode`) | yes                                           | —                            | **yes**                                      |
| works while detached                                 | throws `JSX6E8`                               | needs `connectedCallback`    | **tolerates it, `refresh()` attaches**       |
| fragment items                                       | stray `[object Object]` node on first attach¹ | n/a                          | **attached correctly, indexed per node**     |

¹ measured: an item template returning an array renders `"[object Object]<b>1</b><i>a</i>"` in
`@jsx6/jsx6`; see plan/loop2-plan.md §6. `Loop2` attaches the array nodes.

---

## Options

| option           | type                            | default        | meaning                                                                            |
| ---------------- | ------------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| `item`           | function \| class               | —              | render function or `Jsx6`-style class used for one entry                           |
| `keyBy`          | `(data, i) => key`              | —              | explicit key extractor; a non-nullish result is the key, `undefined`/`null` falls back to `$key`/`loopKey`/template key |
| `typeBy`         | `(data, i) => type`             | —              | the row's type; only rows of the same type share reuse slots — see [Types](#types) |
| `value`          | signal                          | —              | observable array; observed after the current task (a timer), like `Loop`           |
| `primitive`      | boolean                         | `false`        | the values are primitives, not objects                                             |
| `maxPooled`      | number                          | `Infinity`     | how many evicted items stay in the reuse pool; `0` disposes them immediately       |
| `strictKeys`     | boolean                         | `false`        | a datum with a *new* key never inherits an item that owns a different key          |
| `builder`        | function                        | `Loop2Item`    | how one item is constructed (advanced)                                             |
| `setter`         | function                        | `setValue`     | how one item's value is written (advanced)                                         |
| `tpl`            | any                             | —              | template passed through to the item builder                                        |
| `p`              | string                          | —              | scope property the jsx runtime assigns the loop to                                 |
| `onBuild`        | `(item, data, i) => void`       | —              | called after an item was built — the rebuild counter for tests/metrics             |
| `onRelease`      | `(item) => void`                | —              | called after an item's bindings were released                                      |
| `onPark`         | `(item, data) => void`          | —              | called when an item leaves the visible set but is kept for reuse                   |
| `onRestore`      | `(item, data) => void`          | —              | called when an item enters the visible set                                         |
| `onDuplicateKey` | `(key, data, i, first) => void` | `console.warn` | called once per pass when a key repeats in the rendered data                       |
| `onBeforeMove`   | `(item) => void`                | —              | called just before an item's nodes are moved (FLIP animations)                     |
| `onAfterMove`    | `(item) => void`                | —              | called after an item's nodes were moved                                            |
| *anything else*  |                                 |                | copied onto every item as a template attribute                                     |

---

## Keys

A key is an opaque, exactly-comparable value (`Map` semantics: strings, numbers, object identity).
`undefined` and `null` mean **unkeyed**, and unkeyed data keeps index-based reuse — the item that sits
at position *i* stays at position *i* and only its value changes.

`Loop2` resolves a datum's key in this order:

1. **`keyBy(data, i)`** when it returns a non-nullish value. This is the recommended way: it works for
   brand-new objects on every update, for primitives, and for data you do not want to annotate.
2. **`data.$key` / `data.loopKey`** — the properties `insertAttr` writes for a JSX `key`.
3. **the key the item's own template declared** (`key={value.id}`), remembered for that datum object
   when the item was built.

```js
new Loop2({ item: Row, keyBy: row => row.id })        // fresh objects every update: fine
new Loop2({ item: Row, keyBy: (row, i) => i })        // position-locked list (index as key)
new Loop2({ item: Row, primitive: true, keyBy: v => v }) // keyed primitive values
loop.setValue(rows.map(r => ({ ...r, $key: r.id })))  // the Loop-compatible alternative
```

Notes and limits, inherited from `Loop` (see plan/keyed-loop-design.md §2–§4):

- a JSX `key` is evaluated **once**, when the item is built, so a *template-only* key is frozen; that
  is why `keyBy` (or `$key` on the data) is what makes fresh objects matchable;
- a duplicate key keeps the first occurrence in list order; the later one gets an index-matched
  entry, no crash and no duplicated item;
- `$key` on an *element* is overloaded with the `p` attribute group, so only `loopKey` is read there;
- with the default `strictKeys: false`, a datum whose key is new may take over the item that was freed
  at its index (its state included) — this is `Loop`'s behaviour. `strictKeys: true` builds a fresh
  instance instead, and a removed key's parked item is only ever reused by *its own* key.

---

## Types

A **type** is the second axis of a row's identity: it says what *kind* of row this is, so a list that
mixes kinds — a header among rows, a table's group rows, a chat's system messages — never renders one
kind into an item built for another. Without `typeBy` every row is untyped and behaves exactly as it
did before the option existed (one shared pool, index fallback included).

```js
const loop = new Loop2({ item: Row, keyBy: r => r.id, typeBy: r => r.kind })
// a 'header' row only ever reuses an item built for a 'header'; a row never takes a header's slot
```

- **Only rows of the same type share slots.** The index fallback respects it too, so swapping the
  kinds at the same positions builds fresh items for the positions whose type changed instead of
  handing a header's node to a row. The type is carried by the *item* (`typeOf(item)` reads it), which
  is why a parked item is only ever handed to a row of its own type.
- **A falsy type is untyped.** `undefined`, `null`, `''` and `0` all mean "no type", and every such row
  shares the default slot. (A numeric `0` therefore cannot be a type of its own; use a truthy tag.)
- **Where the type comes from**, in order: `typeBy(data, i)` → `data.loopType` / `data.$key.type` →
  the `type` of the key `keyBy` returned (`keyBy: r => ({ id: r.id, type: r.kind })`). It reaches a
  custom `builder` as `opts.type`.
- **Keys stay global across types.** `typeBy` decides which items may be reused, not what identity is
  — if you want per-type keys, make the key say so (`keyBy: (r, i) => \`${r.kind}:${r.id}\``).
- **`keepTypes(types)`** releases the parked items of types you are not going to render again, so they
  do not keep `maxPooled` slots busy for nothing. `maxPooled` itself is the total across the type
  pools, and the least recently parked items are released first.

```js
// a typed loop that knows the kinds its next data will have
loop.keepTypes(new Set(rows.map(r => r.kind)))
loop.setValue(rows)
```

---

## API

| member                                     | meaning                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `setValue(array)`                          | replace the rendered data; matches by key, then by index                                     |
| `getValue()`                               | the values the items report (`item.getValue()`), visible order                               |
| `getData()`                                | a copy of the data array currently rendered                                                  |
| `setItem(data, i)`                         | update/create one position (`i === count` grows the list; anything else outside `0..count` throws `RangeError`) |
| `push(data)` / `pop()`                     | append / remove the last entry; `pop()` parks the item for reuse and returns it              |
| `splice(index, deleteCount, ...toAdd)`     | Array-style edit followed by one full pass; returns the removed **data**                     |
| `moveItem(fromIndex, insertBefore)`        | move an entry, with `Loop`'s "index in the original order" semantics                         |
| `removeItem(item)`                         | remove a **visible** entry (item, index, node or function); throws `JSX6E12` when unknown    |
| `getItem(i)` / `getItems()` / `items`      | visible items                                                                                |
| `getItemByKey(key)` / `getKey(item)`       | key → item, item → key (parked items included)                                               |
| `getItemIndex(item)`                       | index in `allItems` (visible or parked) for an item, a node, an index or a resolver function |
| `typeOf(item)`                             | the type the item was built for, or `undefined` for an untyped one                           |
| `keepTypes(types)`                         | release the parked items of types not in `types` — see [Types](#types)                       |
| `allItems` / `count` / `size()` / `length` | visible items followed by the parked pool, and the counts                                    |
| `domMoves`                                 | how many node moves the DOM ordering performed so far (a metric, not state)                  |
| `refresh()`                                | re-attach and re-order a loop that was populated while detached                              |
| `disposeItem(item)`                        | release one item for good (bindings released, dropped from `allItems`, detached)             |
| `releasePool(keep?)`                       | release parked items beyond `keep` (default `maxPooled`)                                     |
| `dispose()`                                | release the value subscription and every item, visible or parked; idempotent                 |
| `el`                                       | the anchor text node a template inserts                                                      |

Every mutation runs the same matching pass: keyed matching first, index fallback second, pool reuse
or a build third, then DOM attach/order and pool trimming. That is why `push`, `splice` and `setValue`
cannot disagree about which instance an entry gets. A throwing callback (a builder, a setter, a hook)
stops the pass where it stands; the next `setValue` renders the list correctly again.

`Loop2` renders **all** the data it is given. It has no windowing and no virtual scrolling: a shorter
`setValue` parks the surplus items in the reuse pool — detached, never disposed — and a later `setValue`
brings those instances back (bindings and DOM nodes intact). `maxPooled` / `releasePool()` are the only
thing that bounds that pool.

---

## Reuse pool, disposal and teardown

`Loop2` keeps every item it no longer shows in a reuse pool in `allItems`, so removing and re-adding
an entry reuses the same instance — with its state — instead of building a new one. This is the
contract of [plan/disposal-design.md](../../plan/disposal-design.md) §4, unchanged.

- **Hiding never disposes.** `setValue`, `pop`, `splice` and a shrink only detach; bindings stay alive
  so a re-inserted item renders correct content. Items past the end of a shorter array are hidden that
  way — detached from the DOM, still held in the pool — and are reused by the same key later.
- **`disposeItem(item)`** and **`dispose()`** are the permanent paths; `ondestroy()` of a `Jsx6` item
  component runs when its node is disposed.
- **`remove(el)` / `replace(...)`** of any ancestor of the loop disposes it automatically through the
  anchor's disposer (native `el.remove()` and `innerHTML = ''` are not observed — call `disposeNode(el)`
  yourself there).
- **`maxPooled`** bounds the pool. A list that once rendered 10 000 rows keeps 10 000 detached items
  with the default `Infinity`; set `maxPooled: 100` (or call `releasePool()`) to trade reuse for memory.
  Released items are really gone: a later re-insert builds a fresh instance.

```js
const loop = new Loop2({ item: Row, keyBy: r => r.id, maxPooled: 100 })
loop.setValue(rows)        // 10 000 items built
loop.setValue(rows.slice(0, 10))  // 9 990 detached, only 100 kept for reuse
```

---

## Item contract

`Loop2Item` (the default `builder`) produces the same item shape as `@jsx6/jsx6`'s `LoopItem`:

- a **class** `item` is constructed as `new item(attr, [])` and owns its own lifecycle (`Jsx6`
  subclasses get `$v`/`setValue`, `$s`/`setState`, `ondestroy()`);
- otherwise a plain object with `$v`/`setValue`/`getValue`, `$s`/`setState`/`getState` and `el` is
  built, and `item({ $v, value: $v, $s, attr, loop, primitive }, [], comp)` renders it.

An item template may render a single node or an array of nodes (a fragment); `Loop2` attaches, orders,
detaches and indexes every node of a fragment.

---

## Migrating from `Loop`

`Loop2` is a drop-in for the common cases:

```diff
-import { Loop } from '@jsx6/jsx6'
+import { Loop2 } from '@jsx6/loop2'

-<Loop item={Row} p="rows" value={$rows} />
+<Loop2 item={Row} p="rows" value={$rows} />
```

Behaviour to be aware of:

1. `Loop2` keeps a **copy of the data** you pass, and `splice`/`push`/`pop`/`moveItem` edit that copy.
   Mutating your own array in place is no longer sufficient — call `setValue` again or use the loop's
   methods.
2. `removeItem` of a **parked** item throws instead of silently doing nothing (use `disposeItem`).
3. `setItem(data, i)` with `i > count` throws a `RangeError` instead of creating a hole.
4. `splice` returns the removed **data** array (Array semantics), not undefined.
5. A loop populated while detached no longer throws; call `refresh()` after attaching it.
6. Item templates that render a fragment attach correctly (no stray text node).
7. The `key` attribute mirroring of a template `key={...}` is unchanged (a documented `insertAttr`
   side effect).

---

## Further recommendations

The full list with rationale and effort lives in [plan/loop2-plan.md](../../plan/loop2-plan.md) §7.
The short version:

- add `keyBy` to `@jsx6/jsx6`'s `Loop` as an opt-in, non-breaking option (it removes the need to inject
  `$key` into your data);
- fix the fragment-attach bug in `@jsx6/jsx6`'s `Loop` (one-line change plus a test — the probe is in
  the plan);
- export `errorCodes.js` from `@jsx6/jsx6` so sibling packages stop duplicating codes;
- decide on the deprecation path for the two existing Loops rather than shipping a third copy forever.

## License

MIT — see [LICENSE.md](../../LICENSE.md).
