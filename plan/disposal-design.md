# Disposal / teardown design (`@jsx6/jsx6`)

**Created:** 2026-09-22
**Scope:** `libs/jsx6` only. Implements **P2-1** of [improvement-plan.md](./improvement-plan.md#L197-L204)
(lifecycle: the core architectural gap). `@jsx6/signal` is unchanged — it already returns proper
unsubscribe functions.
**Status:** stages 1–3 implemented; tests in [dispose.test.js](../libs/jsx6/src/dispose.test.js).

---

## 1. The symbol contract

`@jsx6/signal`'s `observeNow($signal, updater)` returns an unsubscribe function (or `undefined` for
a static value). `addEventListener` needs a matching `removeEventListener`. Those teardown functions
were previously discarded. They are now collected **on the node that owns them**:

```js
// src/dispose.js
export const jsxDisposeSymbol = Symbol.for('jsx6_dispose') // node[jsxDisposeSymbol] = [fn, ...]

addDisposer(node, dispose) // push one teardown function (no-op if `dispose` is not a function)
disposeNode(node)          // release a node, its subtree, or a component/array of them
```

- `Symbol.for('jsx6_dispose')`, not `Symbol()`, for the same reason `jsx2dom_marker` /
  `jsx2dom_scope` use `Symbol.for`: two copies of `@jsx6/jsx6` on one page must agree on the key.
- The list is created lazily, so nodes with no bindings carry no extra property.
- Public entry points: `disposeNode`, `addDisposer` and `jsxDisposeSymbol` are re-exported from
  `src/jsx2dom.js`, which `index.js` already re-exports, so `import { disposeNode } from '@jsx6/jsx6'`
  works. They are re-exported from **one** module only: a second `export *` of the same name would
  make the name ambiguous and silently drop it.

### `disposeNode(node)` semantics

- accepts an element, text node, component (anything with `.el`), or an array of those; anything
  else (`null`, strings, `{}`) is a tolerated no-op;
- walks the **whole subtree** (`childNodes`, snapshotted first) plus the node itself;
- **post-order**: descendants are released before the node's own teardown, so a component's
  `ondestroy()` runs after its subtree's bindings are gone;
- **idempotent**: the list is replaced by an empty array *before* the callbacks run, which also
  makes it safe against re-entrancy (a disposer may dispose its own node);
- **never throws and never detaches**: a failing teardown is logged (`console.error('jsx6 dispose
  failed', …)`) and the rest of the subtree is still released. Detaching stays the job of
  `remove()` / `replace()` / native DOM calls;
- returns the number of teardown functions released (used by tests; `0` means "nothing left").

---

## 2. Stage 1 — collect (non-breaking)

| Where | What is now collected |
|---|---|
| `jsx2dom.js` `insertAttr` | `observeNow(value, updater)` for every signal-valued attribute |
| `jsx2dom.js` `insertAttr` | the bound `on*` listener (`() => out.removeEventListener(name, listener)`) |
| `jsx2dom.js` `nodeFromObservable` | the subscription for a signal used as a child; owned by the anchor text node that stays in the DOM for the binding's whole life |
| `directives.js` | all six `observeNow()` directives (`x-if`, `x-else`, `x-enabled`, `x-disabled`, `x-readonly`, `x-value`) |
| `directives.js` `x-value` | its `input` listener (writes back into the signal — not leaving it attached to a dead node) |
| `Jsx6.js` | the `ondestroy` hook (stage 3, below) |
| `Loop.js` | the value subscription (stage 2, below) |

Stage 1 alone changes nothing observable: it only stops discarding the functions.

## 3. Stage 2 — release automatically on the common paths

| Path | Behaviour |
|---|---|
| `remove(child)` | disposes the subtree **before** detaching, then detaches exactly as before (an orphan still throws and still logs one line — `browser.test.js` guards that) |
| `replace(new, old, alsoDestroy)` | disposes `old` first; `alsoDestroy` was previously accepted-and-ignored, it now means "dispose" and defaults to `true` |
| `replaceContent(parent, new, alsoDestroy)` | disposes the children before `innerHTML = ''` (which otherwise drops them without any teardown) |
| `Loop#disposeItem(item)` | permanent eviction of one item (see §4) |
| `Loop#dispose()` | permanent teardown of the loop (see §4) |
| Loop anchor disposed | `disposeNode()` on a container that holds the loop's anchor calls `Loop#dispose()`, so removing a component tears down its loops, **including the hidden reuse pool** and the value subscription |

Disposed automatically therefore: any subtree removed through `remove()` / `replace()` /
`replaceContent()` and any Loop they contain.

**Manual / not automatic:** native `el.remove()`, `parentNode.removeChild(el)`,
`parent.innerHTML = ''`, `document.body.innerHTML = …` and any code that detaches without going
through `@jsx6/jsx6`. Call `disposeNode(el)` explicitly there (or use `remove()`). This is the
documented limit of a non-breaking change: jsx6 cannot observe native DOM calls without a
MutationObserver, which was deliberately not added.

## 4. The Loop reuse caveat (deliberate non-disposal)

`Loop` keeps **every item it has ever built** in `allItems`; the visible ones are
`allItems.slice(0, count)` and the rest form a reuse pool served by `setValue`/`splice`/`push`.
`_fixItemList()` and `splice()` therefore only **detach** (`removeChild`), they never dispose:

- `_fixItemList(reindex)` — the `i >= count` branch detaches; the item stays in `allItems`.
- `splice()` removal path — the removed items are pushed back onto `allItems` and detached.
- `pop()` — decrements `count` and detaches; the node stays at index `count`.

Disposing there would permanently kill the item's bindings, so a later re-insert would render
**stale content** (the reused node would keep its old text). That is the exact scenario
`browser.test.js` asserts ("Shrinking detaches items that must be available for reuse"), and
`dispose.test.js` asserts the same through `@jsx6/jsx6`'s own bindings. So **disposal-on-hide is not
appropriate**; the reuse pool is intentional and bounded by the loop's peak size.

Items really leave the loop for good only through the explicit APIs added here:

- `Loop#disposeItem(item)` — release, drop from `allItems`, detach, reindex. Returns the item, or
  `undefined` when it is not part of the loop. After it, the item can never be reused.
- `Loop#dispose()` — release the value subscription and **every** item in `allItems` (visible and
  hidden), then empty `items`/`allItems`/`count`. Idempotent; returns `this`. A disposed loop that
  is later reused through a manual `setValue()` builds fresh items, but its watched signal is no
  longer observed.

`Loop#dispose()` is also what the anchor's disposer calls, so `remove(container)` frees the reuse
pool too. A `Loop` object that is still referenced after its container was removed keeps its hidden
(detached) items alive — that is the intended cache behaviour, not a leak: the hidden nodes are
reachable only through the loop.

---

## 5. Stage 3 — the `ondestroy()` hook

`Jsx6` subclasses (or instances) may define an optional `ondestroy()`:

```js
class Widget extends Jsx6 {
  tpl() { return h('DIV', null, 'widget') }
  ondestroy() { /* release external resources, timers, observers, … */ }
}
```

Contract:

- **optional and duck-typed** — looked up on the instance at dispose time, so it can also be
  assigned after construction (`w.ondestroy = fn`), not only defined on a prototype;
- **called at most once** — it is registered as one ordinary teardown function, and teardown lists
  are consumed on first release. `disposeNode()` twice calls it once;
- **when** — during `disposeNode()` of the component's element, after the whole subtree's bindings
  have been released, and before the node is detached (`remove()` disposes before it detaches);
- **errors** are caught and logged by `disposeNode()`, they do not abort the rest of the teardown;
- `ondestroy` is deliberately **not declared as a class field**: `ondestroy` as a field initializer
  would create an own `undefined` property on every instance and shadow an `ondestroy()` method on a
  subclass prototype. It is called through `callOndestroy()` in `Jsx6.js`.
- pre-existing `Jsx6old` (legacy, `@ts-nocheck`) and plain object components built by
  `LoopItem` have no `ondestroy`; they participate only through `addDisposer()`.

---

## 6. Open / follow-up (not done here)

1. **`@jsx6/w`'s `JsxW`** needs the identical hook and the same node-level collection. `libs/w` was
   explicitly out of scope for this change; it should get `ondestroy()` plus disposer collection on
   its custom elements in a separate item (P3-2 keeps `JsxW` as the canonical component model).
2. **`index.js`** could additionally `export * from './src/dispose.js'`. It is not required today
   (`disposeNode` is reachable through the `jsx2dom.js` re-export) and was avoided in this change
   because `index.js` was off-limits to concurrent editors; adding it later would be ambiguous with
   the current re-export and both must be changed together.
3. **Native detach paths** (`el.remove()`, `innerHTML = ''`) are not observed (see §3). A
   `MutationObserver`-based auto-disposal was considered and rejected: it would change behaviour of
   a hot path and reintroduce exactly the kind of hidden global machinery this library avoids.
4. **`@jsx6/signal` derived signals** (`$S`/`$F`) still subscribe eagerly and never release their
   own dependencies — P2-4, unchanged and out of scope here.
5. **Loop keyed reconciliation** (P2-2) is untouched; `disposeItem()` is index/key-agnostic and
   should keep working once keyed reuse lands.
6. The `Loop` in `libs/w` is a separate copy (P3-2) and has not been given any of this.