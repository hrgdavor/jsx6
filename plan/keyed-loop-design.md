# Keyed `Loop` reconciliation (`@jsx6/jsx6`)

**Created:** 2026-09-22
**Scope:** `libs/jsx6` — `src/Loop.js` (implementation) and `src/Loop.test.js` (tests). Implements
**P2-2** of [improvement-plan.md](./improvement-plan.md#L202) ("`key` is inert").
**Status:** implemented; `bun test` 54 pass / 0 fail (18 in `Loop.test.js`, 14 of them new here),
`bun x tsc --noEmit -p libs/jsx6/tsconfig.json` clean.
**Related:** [disposal-design.md](./disposal-design.md) (P2-1) — its reuse/disposal contract is
unchanged by this work and is asserted to still hold (§5).

---

## 1. The problem

`insertAttr` ([jsx2dom.js:236-247](../libs/jsx6/src/jsx2dom.js#L236-L247)) has always stored a JSX
`key` as `node.loopKey` (always) and `node.$key` (when that property is still free), and mirrored it
onto the component when `insertAttr` is given one. Nothing read either property, and `Loop`
reconciled purely by position (`allItems[i]`) — `setValue`, `splice`, `push`, `pop` and `moveItem`
all reused "the item that happens to sit at this index". Reordering therefore kept every instance at
its old index and pushed new *data* into it: the DOM text came out right, but the component
instances, their state, their focus/scroll/selection and their local signals belonged to the wrong
entries. The published plan records the reproduction ("`Loop` rebuild count unchanged across a
reorder").

This document fixes that by giving `key` a meaning, while keeping the observable behaviour of the
index-based path identical for data that has no key (same instances, same DOM nodes, same order, no
extra DOM mutations).

---

## 2. The key contract

Only the existing mechanism is used: the `loopKey` / `$key` properties that `insertAttr` writes for
a JSX `key`. There is no second key attribute, no symbol and no per-item key field added to user
data.

### 2.1 What `insertAttr` stores (the ground truth)

| Situation | Stored |
|---|---|
| `<li key={...}>` (string/element tag) | `el.loopKey = value`, `el.$key = value` (if `$key` was free) |
| component element with a component arg (`Jsx6old`, `JsxW`) | the same on the element, plus `component.loopKey = value`, `component.$key = value` (if free) |
| `<li p="form.name">` | `el.$key = 'name'` (the `p` **group** name, see `setPropGroup`) |

Two consequences drive the design:

1. **`loopKey` is the trustworthy marker.** `$key` is shared with the `p` attribute group name, so on
   an *element* it is ambiguous; `loopKey` is written only by a `key`. Loop therefore reads
   `el.loopKey` and deliberately ignores `el.$key`; on the *item object* it reads
   `item.loopKey ?? item.$key` (the property the plan names for the class-component shape).
2. **`key={value.id}` stores a signal, not the value.** In jsx6 a data expression is a signal
   function, so `insertAttr` puts the function into `loopKey` and then — because a function-valued
   attribute is treated as an observable — calls `setAttribute(node, 'key', fn())` and keeps the
   `key` *attribute* up to date reactively. Loop resolves a function-valued key by calling it
   (`keyValue()`), which is exactly what `insertAttr`'s own updater does; the result is the value
   the user wrote (`'a'`), not a signal identity. (Side effect worth knowing: an item template that
   uses `key={...}` also renders a `key="…"` attribute — pre-existing `insertAttr` behaviour, not
   introduced here.)

### 2.2 What a key is, per source

A key is an opaque, exactly-comparable value (`Map` key semantics: strings, numbers, object
identity, …). `undefined` and `null` mean **unkeyed**.

| Source | Rule |
|---|---|
| **datum** (primary) | `keyValue(data.loopKey ?? data.$key)`; if the datum is itself a built item/component, `keyValue(data.el.loopKey)` (so `loop2.setValue(loop1.getItems())` keeps identities) |
| **built item**, class component (`item.prototype` truthy → `new item(attr, [])`) | `keyValue(item.loopKey ?? item.$key)` — the properties `insertAttr` mirrors onto the component |
| **built item**, plain object from a render function (`comp.el`) | `keyValue(el.loopKey)` — the key the item template wrote (`key={value.id}`); for a fragment template the first node is used |
| **built item**, primitive (`primitive: true`) | **none.** A text node has no place to declare a key, and a primitive datum cannot be a `WeakMap` key, so primitive loops stay index-reconciled |
| **primitive datum** | **none** (see above) |

### 2.3 The frozen-key insight (why the datum is the primary carrier)

`insertAttr` evaluates a JSX `key` **once, when the element is built**. Loop never re-runs an item's
template, so an item's declared key is frozen and belongs to the datum the item was built with —
re-reading it after the item was reused for different data would report a stale key. Consequences:

* Matching *incoming* data against the map needs a key that can be read *before* an item exists. Only
  the datum can provide that, hence `$key`/`loopKey` on the data is the reliable contract.
* The item's own declared key is still honoured: right after `makeItem()` Loop reads it and remembers
  it **for that datum object** (`_dataKeys`, a `WeakMap`). Reordering the *same* datum objects — the
  common case when an app sorts/splices its own array — therefore moves the right instances even when
  the app never put a key on the data.
* A class-component item is the extreme case: `new item(attr, [])` runs `tpl()` *before*
  `setter(comp, data)` assigns the value, so `key={this.$v.id}` is `undefined` at build time. Class
  items should carry their key on the **data** (verified by a test).

### 2.4 Recommended usage

```js
// explicit key on the data — works with fresh objects on every update
loop.setValue(items.map(i => ({ ...i, $key: i.id })))
// or, idiomatic: key the item template; matching then works for the same datum objects
const Row = ({ value }) => h('LI', { key: value.id }, value.name)
loop.setValue(items)             // items[i] objects stay identical across updates
loop.setValue([items[2], items[0], items[1]])   // instances (state, node, bindings) move with them
loop.getItemByKey(id)            // new accessor: the item registered under a key
```

---

## 3. The algorithm

`Loop` keeps one map, `keyMap: Map<key, item>`, plus two `WeakMap`s for bookkeeping:
`_itemKeys` (item → key it owns; the reverse of `keyMap`) and `_dataKeys` (datum → key its item
declared at build time). No user data is mutated to store keys.

### 3.1 `setValue(v)` — full reconciliation in four passes

1. **wanted keys** — `wanted[i] = dataKey(v[i]) ?? _dataKeys.get(v[i])`.
2. **keyed match** — each datum with a key claims `keyMap.get(key)` if that item is not already
   claimed by an earlier datum.
3. **index fallback** — any still-unassigned position takes `allItems[i]` exactly as before, if that
   item is not already claimed.
4. **reuse or build** — remaining positions take a *parked* item (in the reuse-pool order) or
   `makeItem()`.

Then `allItems = next.concat(leftovers)`, `count = n`, values are written with `setter(item, data, i)`
exactly once per item (`makeItem` already set the value for items it created), keys are re-bound with
first-occurrence-wins, and `_fixItemList(true)` attaches/detaches and calls `_orderDom()`.

`_orderDom()` walks the visible list backwards, anchoring each item directly before the next one (the
last before the loop's anchor text node) and only calls `insertBefore` when the node is not already in
place — so an unchanged list performs **no** DOM mutation, and a reorder performs only the moves that
are actually needed (a 3-item rotation moves 2 nodes).

### 3.2 `setItem(newData, i)` / `push` — one entry at a time

Keyed data claims the item that owns its key **only when that item is parked in the reuse pool**, and
puts it into slot `i` by *swapping* with whatever occupied that slot (length and positions stay
stable, which `splice`'s replace path depends on). A key owned by a *visible* item is left alone:
reordering visible entries is `setValue()`'s job, and a duplicate key must never silently rearrange
the list. `push(data)` is `setItem(data, count)` and behaves the same way, so a keyed entry that was
`pop()`ped is reused (state intact) by the next `push()` of the same key.

### 3.3 `splice(index, deleteCount, …toAdd)`

* **insert path** (`deleteCount <= 0`): a parked item owning the datum's key is claimed and *moved*
  into the insertion slot; otherwise the old behaviour is unchanged — pop the last reusable item, or
  `makeItem()`.
* **replace path** (`deleteCount > 0`): delegates to `setItem` (in-place swap as above), then removes
  the remaining deleted entries exactly as before.
* `pop()`, `moveItem()`, `removeItem()` and `disposeItem()` keep their existing semantics; keys ride
  along with the items they belong to.

### 3.4 Map maintenance

| Event | Effect on the map |
|---|---|
| item built | its declared key (template) or the datum's key is registered; the datum remembers it |
| item claimed by key | stays the owner; the instance is moved, never rebuilt |
| item reused **by index** for keyless data | keeps the key it was built/claimed with (the element's key is frozen anyway) |
| item parked (removed from the visible range) | **keeps** its key — that is what makes remove/re-add reuse the instance |
| item reused for *different keyed* data | the new key wins; the old key entry is dropped |
| `disposeItem(item)` | the key is released with the item |
| `dispose()` | `keyMap`/`_itemKeys`/`_dataKeys` are cleared |

---

## 4. Duplicate and missing keys

| Case | Behaviour |
|---|---|
| **no key on data, no template key** | index-based reuse exactly as before; nothing is added to the map |
| **keyed and unkeyed data mixed** | the keyed entries are matched and moved; unkeyed positions use the index fallback and can be displaced by a keyed claim |
| **duplicate key in one `setValue`** | the *first* occurrence in list order owns the item/key; later duplicates are index-reconciled and are not registered (no crash, no item duplication beyond what the data asked for) |
| **duplicate key via `setItem`/`splice`** | the new entry gets its own item; a *visible* owner keeps the key (`_claimKey` refuses to steal) |
| **key whose item was disposed** | no match: a fresh item is built (`disposeItem` released the key on purpose) |
| **key value that is an object** | matched by identity (`Map` semantics) |
| **function-valued key** | called once (`keyValue`), mirroring `insertAttr`'s own updater; `undefined`/`null` results count as unkeyed |

---

## 5. Interaction with the reuse pool and P2-1 disposal (unchanged contract)

The P2-1 rule is preserved *exactly*: hidden/evicted items stay in `allItems` **for reuse** and are
never disposed on hide. `_fixItemList`'s `i >= count` branch still only detaches, `splice`'s removal
path still pushes the removed items back onto `allItems` and only detaches them, and `pop()` still
detaches. The comments left at those sites were kept verbatim and no `disposeNode` call was added.
Names that still leave the loop for good are `disposeItem()` and `dispose()`; both now also release
the item's key association, and `dispose()` clears the three maps so a disposed loop does not retain
keyed items through `keyMap`.

What *did* change is only bookkeeping:

* a parked item keeps its key, which is the point: `setValue`/`splice`/`push` can now reuse *that*
  instance instead of whichever item happened to be last in the pool;
* `Loop`'s retention profile is unchanged in kind — a parked keyed item was already retained by
  `allItems`, and `keyMap` points at items the loop already owns (cleared by `dispose()`);
* `disposeItem()`/`dispose()` remain index/key-agnostic from the caller's point of view, as
  `disposal-design.md` §6.5 anticipated.

`libs/jsx6/src/dispose.test.js` (11 tests, including "Loop hides evicted items for reuse and only
releases them on request" and "Loop.dispose() releases every item, including the hidden ones") still
passes untouched.

---

## 6. Evidence

`libs/jsx6/src/Loop.test.js` (existing 4 tests still pass, 14 new, `GlobalRegistrator` style):

| Test | What it proves |
|---|---|
| reorder with keys moves the same item instances | identity of item objects **and** DOM nodes after `[a,b,c] → [c,a,b]`; `getValue()` follows the instance; `getItemByKey` |
| keyed reordering does not rebuild items | a counting `builder` stays at 3 across a reorder (nothing rebuilt) |
| insert at the front | only the new entry is built; the two existing instances stay |
| remove from the middle | sibling order correct; the removed item is parked (`allItems.length` unchanged, detached, key retained); re-adding the key returns the **same** instance with its state |
| keyed component instances keep their state | a `Jsx6` subclass with an instance field keeps it across a reorder; other instances are untouched |
| a key written in the item template participates | `key={value.id}` → `el.loopKey` set, `key` attribute mirrored; reordering the same datum objects moves the instances |
| unkeyed data keeps index-based reuse | same instances, same nodes, content swapped in place, `keyMap` empty |
| keyed and unkeyed coexist | only the keyed entry is matched by key |
| duplicate keys | first occurrence owns the key; the list stays consistent across a further reorder |
| parked keyed item keeps its bindings | the parked (hidden) item is **not** disposed: its signal binding still updates its node; `dispose()` then clears the key map |
| `splice` re-claims a parked keyed item | middle removal + re-add reuses the parked instance (with a mutation mark) |
| `splice(index, deleteCount, keyedData)` | replace path claims the parked instance in place (`[A,B,C] → [A,C] → [B,C]` with the same `B`) |
| `push`/`pop` | a popped keyed item stays reusable and is claimed by the next `push` of its key |
| `disposeItem` releases the key | after disposal the key is gone and re-adding the key builds a fresh item |

Verification commands (run from the repo root / `libs/jsx6`):

```
bun x tsc --noEmit -p libs/jsx6/tsconfig.json     # exit 0, zero diagnostics
bun test                                          # in libs/jsx6: 54 pass / 0 fail, 10 files
bun run scripts/verify.js --no-tests --no-types --no-declarations --no-versions --no-manifests
                                                  # eslint + docs sync: "All checks passed"
```

The unrelated lint error the gate reported in `Loop.js` (`'h' is defined but never used`) was removed
as part of this change.

---

## 7. Limitations and open questions

1. **Fresh datum objects cannot be matched by a template-only key.** If every update passes brand-new
   objects and the data carries no `$key`/`loopKey`, Loop cannot know the new key before rendering, so
   it falls back to index reuse (today's behaviour). Put the key on the data for that case. Making the
   template key match fresh objects would require rendering a probe item per update and throwing the
   duplicate away — rejected (§8).
2. **The item's declared key is frozen.** The `key` *attribute* stays live (insertAttr's subscription
   updates it), but `loopKey` and the remembered datum key are build-time values. If an app mutates a
   datum's `id` in place, the remembered key is stale; pass a new `$key` instead.
3. **`$key` is overloaded with `p`.** Loop reads `$key` only on the item object, never on an element.
   An item whose template uses `p` is therefore not mis-read as keyed. A custom `builder` that sets a
   `p` group on the component itself could still collide; use `key`/`loopKey` there.
4. **Class-component items:** keys come from the data (see §2.3). Documented, not worked around.
5. **Fragments:** `_orderDom` handles an item that renders an array of nodes, but the declared key is
   read from the first node only.
6. **Primitives are never keyed.** A primitive *is* its value, and the same value can legitimately
   appear twice, so keying primitives by value would change existing `primitive: true` behaviour and
   introduce ambiguous duplicate keys. **Open question:** if a keyed primitive list is wanted, the
   options are (a) wrap the value in a keyed object (`{ $key: v, value: v }`, read `value.value` in
   the template — works today) or (b) opt in with `primitive` + value-as-key; (b) needs a deliberate
   decision because it is not backward compatible.
7. **No `keyBy`/`getKey` extractor option.** `@jsx6/virtual-scroll` has a `getKey(item)` config, and a
   `keyBy` on `Loop` would make `id`-keyed data ergonomic. It is deliberately **not** added here: the
   brief requires using the existing `loopKey`/`$key` mechanism and not inventing a second one.
   **Open question** for the maintainer; if it is wanted, `dataKey()` is the single place to extend.
8. **Misuse:** `setItem(data, i)` with `i` beyond `allItems.length` keeps its old (hole-creating)
   behaviour, which `_fixItemList` never supported; nothing regressed, but it is still unchecked.

---

## 8. Rejected alternatives

| Alternative | Why not |
|---|---|
| Build a probe item for every datum to learn its key, then keep the matched old items and discard the probes | doubles the work of every update, churns the DOM, and destroys the state of the discarded instances with no way to release them cleanly |
| Match unkeyed object data by object identity | would change behaviour for data that deliberately has no key (and contradicts "items without a key keep today's index-based behaviour") |
| A `keyBy`/`getKey` option as the only key source | a second key mechanism, explicitly out of scope here (kept as an open question, §7.7) |
| Remove the `key` handling and document index-only reconciliation | the plan's alternative if keyed lists were unwanted; the functional gap versus Solid/React is real, so it was implemented instead |
| A virtual-DOM/diff layer | out of scope by decision (plan §4) |

---

## 9. Should `libs/w`'s `Loop` follow?

**Yes — as a separate follow-up, not in this change.** `libs/w/src/Loop.js` is a second, newer copy
with the same index-based `setValue`/`setItem`/`splice`/`_fixItemList` shape and the same
`LoopItem` builder, so §2–§4 apply verbatim; `JsxW` already calls
`insertAttr(attr, this, this, this)` ([JsxW.js:67](../libs/w/src/JsxW.js#L67)), i.e. it stores
`loopKey`/`$key` on the custom element *and* the component exactly like `Jsx6old` does. Differences
that make it a separate item rather than a copy-paste:

* it is an `HTMLElement` (`jsx6-loop`) with `connectedCallback`/`disconnectedCallback`, an
  `insertParent` that can be the parent (`outside`) or the element itself, and a `lastValue`
  fallback for `getValue()` while detached;
* `connectedCallback` re-inserts `this.items` before the host, so the keyed reconciliation must also
  run (or at least re-order) on connect, not only on `setValue`;
* it has none of the P2-1 disposal machinery (`disposeItem`/`dispose`/`don't dispose on hide`), so
  there is no `disposeItem` key release to mirror and no `dispose()` map clearing; when P2-1 lands
  there, the same three maps should be cleared at the same points;
* `libs/w` has its own test file (`libs/w/src/Loop.test.js`, 4 tests) and its own gate.

The plan (P3-2) calls `@jsx6/w`'s Loop the canonical one and the jsx6 copy deprecated, so leaving it
unkeyed would split the two implementations further. Recommendation: port this file's helpers
(`dataKey`/`itemKey`/`keyValue`/`nodesOf`), `_orderDom`, the four-pass `setValue` and the
`keyMap`/`_itemKeys`/`_dataKeys` bookkeeping, then add the same reorder/insert/remove/state tests
there. It is deliberately not done here: the brief scopes this change to `libs/jsx6` and explicitly
excludes `libs/w` (separate copy, own tests).