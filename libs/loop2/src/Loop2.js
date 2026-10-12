/**
 * Loop2 — the keyed list renderer of the jsx6 family (v2).
 *
 * `@jsx6/loop2` is a **separate package on purpose**: `Loop` in `@jsx6/jsx6` and the `jsx6-loop`
 * custom element in `@jsx6/w` keep their current behaviour untouched, while this file is free to
 * fix the design defects those two share. Nothing here changes existing code — see
 * [plan/loop2-plan.md](../../../plan/loop2-plan.md) for the inventory, the phased plan and the
 * recommended follow-ups.
 *
 * What Loop2 does differently from `@jsx6/jsx6`'s `Loop`:
 *
 * 1. **one algorithm for every mutation** — `setValue`, `push`, `pop`, `splice`, `moveItem` and
 *    `removeItem` all edit one data array and run the same keyed reconciliation, instead of the
 *    four divergent hand-written paths (`setValue` / `setItem` / `splice` / `push`,`pop`) that
 *    produced the P0-3 / P0-4 defects and the keyed-vs-index inconsistencies between them;
 * 2. **`keyBy(data, index)`** — an explicit key extractor. This closes the documented limitation
 *    that fresh datum objects carrying only a template `key={value.id}` cannot be matched
 *    (plan/keyed-loop-design.md §7.1) and makes keyed **primitive** loops possible (§7.6), with no
 *    `$key` injection into user data and no probe render;
 * 3. **bounded reuse pool** — `maxPooled` (and `releasePool()`) so a list that once showed 10 000
 *    rows can drop the nodes it no longer shows instead of retaining them for the loop's lifetime;
 * 4. **honest mutation API** — `splice` returns the removed data (Array semantics), `setItem`
 *    throws on an index it cannot honour instead of creating holes (§7.8), `removeItem` refuses
 *    parked instances;
 * 5. **no throw when detached** — building items while the loop anchor has no parent is legal and
 *    `refresh()` attaches them once the anchor is in the DOM (the reason `@jsx6/w`'s Loop needs a
 *    `connectedCallback`);
 * 6. **O(1) item lookup** — an internal index map over items *and* their nodes, so `getItemIndex`
 *    is not dependent on a stale `loopIndex` stamp and fragments are indexed per node;
 * 7. **windowing-ready** — `startIndex` + `setWindow(slice, startIndex)` let a scroll host drive the
 *    loop with the visible slice of a list that is far too large to render, while every index the
 *    loop reports (`keyBy`, `onBuild`, the item's `attr.i`, the node stamps) stays **absolute** and
 *    the bounded pool (`maxPooled`) is what keeps the node count bounded;
 * 8. **robust against a throwing hook** — the reconciliation finishes its bookkeeping in a `finally`
 *    and every item it ever built is visible or parked (never orphaned), and the per-frame hooks a
 *    scroll host needs — `onPark`, `onRestore`, `onDuplicateKey`, `onBeforeMove`/`onAfterMove` —
 *    are fired once per item per change.
 *
 * Features 7 and 8 are the **alignment with `@jsx6/virtual-scroll`**: the two packages are designed
 * to be driven by one scroll host and to agree on the key extractor's call signature
 * (`getKey(item, index)` there, `keyBy(data, index)` here) and on the meaning of an index (absolute,
 * not window-relative). They still share **no code and no dependency** — either one works alone.
 *
 * Everything else is deliberately kept as-is, including the reuse-pool semantics, the DOM ordering
 * that performs no mutation when the order is already right, and the disposal contract of
 * plan/disposal-design.md (hidden items are never disposed on hide).
 */
import {
  addDisposer,
  disposeNode,
  domWithScope,
  factories,
  forInsert,
  insert,
  setValue,
  throwErr,
  toDomNode,
} from '@jsx6/jsx6'

import { $State, observeNow, signal } from '@jsx6/signal'

/** `@jsx6/jsx6`'s `JSX6E12_ITEM_NOT_FOUND` (src/errorCodes.js). The code is duplicated here because
 *  `index.js` of `@jsx6/jsx6` does not re-export `errorCodes.js`, so a sibling package cannot import
 *  it — see "further recommendations" in plan/loop2-plan.md. The value must stay in sync. */
const JSX6E12_ITEM_NOT_FOUND = 12

// ---------------------------------------------------------------------------------------------
// Key helpers. The key *contract* is the one plan/keyed-loop-design.md §2 defines for `Loop`: the
// `loopKey` / `$key` properties that `insertAttr` writes for a JSX `key` are the only key source,
// and `keyBy` (new here) is consulted first when the app provides one.
// ---------------------------------------------------------------------------------------------

/** Can `value` be used as a `WeakMap` key? (only objects and functions can be) */
const isWeakKey = value => value !== null && (typeof value === 'object' || typeof value === 'function')

/** Resolve a stored key to the value the user wrote.
 *
 *  In jsx6 a data-driven key (`key={value.id}`) is a signal — a function — so reading a key means
 *  calling it, exactly like `insertAttr`'s own updater does (`setAttribute(node, 'key', func())`).
 */
const keyValue = key => (typeof key === 'function' ? key() : key)

/** Key declared by a *datum* through the `$key` / `loopKey` properties `insertAttr` writes, or by
 *  the root element of a datum that is itself a built item/component (anything with `.el`).
 *
 *  `undefined` means "unkeyed": the datum takes the index-based reuse.
 */
const dataKey = data => {
  if (!isWeakKey(data)) return undefined
  let key = keyValue(data.loopKey ?? data.$key)
  if (key !== undefined && key !== null) return key
  const el = data.el
  // a datum that is a Loop/Loop2 item built elsewhere (`loopB.setValue(loopA.getItems())`)
  if (el && !(el instanceof Array) && el.nodeType) key = keyValue(el.loopKey)
  return key ?? undefined
}

/** Key a *built item* declared for the data it was constructed with: its own `$key`/`loopKey` (set
 *  by `insertAttr` for class components), or the `loopKey` of its root element (the plain-object
 *  item shape, where the item template wrote `key={...}`).
 *
 *  Only meaningful right after `makeItem()`: `insertAttr` evaluates a JSX `key` once, at build time,
 *  so the value is frozen and belongs to the datum the item was built with.
 *
 *  `el.$key` is deliberately NOT read here — on an element it is also the `p` attribute group name
 *  (`setPropGroup`), so it is ambiguous; `loopKey` is written only by a JSX `key`.
 */
const itemKey = item => {
  if (!item) return undefined
  let key = keyValue(item.loopKey ?? item.$key)
  if (key !== undefined && key !== null) return key
  const el = item.el
  const node = el instanceof Array ? el[0] : el
  if (node && node.nodeType) key = keyValue(node.loopKey)
  return key ?? undefined
}

/** The DOM nodes one item contributes (an item template may render an array of nodes). */
const nodesOf = item => {
  const el = toDomNode(item)
  if (!el) return []
  if (el instanceof Array) return el.filter(n => n && n.nodeType)
  return el.nodeType ? [el] : []
}

/**
 * The **type** family, the second axis of a row's identity (the first is its key).
 *
 * A falsy type — `undefined`, `null`, `''` or `0` — means "untyped" and shares the one default slot,
 * which is also what a loop without `typeBy` uses for every row: existing behaviour, unchanged.
 */
/** Is `type` a real type (a non-falsy value)? Every falsy value falls into the default slot. */
const hasType = type => !!type

/** Type declared by a *datum*, through the `loopType` property or `$key.type` (the object form of a
 *  JSX `key` — see `insertAttr`). `undefined` means untyped. */
const dataType = data => {
  if (!isWeakKey(data)) return undefined
  const declared = keyValue(data.loopType)
  if (hasType(declared)) return declared
  const key = data.$key
  return isWeakKey(key) && hasType(key.type) ? key.type : undefined
}

/**
 * Options accepted by the Loop2 constructor. Every property that is not listed here is copied onto
 * each item as an attribute (`itemAttr`), exactly like `Loop`.
 *
 * @typedef {object} Loop2Options
 * @property {any} [p] property path where the loop element is assigned on the parent scope (handled
 *   by the jsx runtime, `insertAttr`/`setPropGroup`, not by Loop2 itself)
 * @property {any} [item] component or render function used to create a single loop item
 * @property {Function} [builder] creates a single loop item, defaults to {@link Loop2Item}
 * @property {Function} [setter] sets the value of a loop item, defaults to `setValue`
 * @property {any} [tpl] template function used by the loop items
 * @property {any} [value] observable holding the array of items; observed on a timer, like `Loop`
 * @property {boolean} [primitive] true when loop values are primitive values
 * @property {(data: any, index: number) => any} [keyBy] explicit key extractor, called for every
 *   datum on every reconciliation. `index` is absolute (`startIndex + position`, see the option
 *   below). When it returns a non-nullish value that value is the key and the `$key`/`loopKey`
 *   heuristics are not consulted for that datum; returning `undefined`/`null` falls back to them.
 *   The signature is the one `@jsx6/virtual-scroll` calls `getKey` with — see {@link KeyOf}.
 * @property {(data: any, index: number) => any} [typeBy] type extractor, the second axis of a row's
 *   identity. Only rows of the **same type** share reuse slots: a row of type `'header'` never takes
 *   over the item a `'row'` left behind, and vice versa (the index fallback respects it too). A
 *   **falsy** result — `undefined`, `null`, `''`, `0` — means untyped: every such row shares the one
 *   default slot, which is exactly what a loop without `typeBy` does, so adding the option to a list
 *   of one type changes nothing. The type is looked up like the key: `typeBy` → `data.loopType` /
 *   `data.$key.type` → the type of the key `keyBy` returned. Keys stay **global** across types, so
 *   `typeBy` is about which items may be reused, not about scoping identity (make the extractors
 *   agree if you want `keyBy: (r, i) => \`${r.type}:${r.id}\``). An item's type is readable with
 *   {@link Loop2#typeOf}.
 * @property {number} [maxPooled] how many evicted items stay in the reuse pool (default `Infinity`,
 *   the behaviour of `Loop`). `0` disposes every evicted item; a finite number bounds the retained
 *   DOM nodes. See {@link Loop2#releasePool}.
 * @property {boolean} [strictKeys] when true, a datum whose key has no owner never inherits an item
 *   that *owns another key*: only an item that owns no key may be recycled from the pool, otherwise a
 *   fresh instance is built. Default `false`, which is `Loop`'s behaviour (the item that was freed at
 *   that index is recycled, state included).
 * @property {number} [startIndex] the absolute index of the first datum the loop renders (default
 *   `0`). Every index the loop hands out — the `i` of `keyBy`, `onBuild`, `onDuplicateKey`, the
 *   item's `attr.i` and the node stamps — is `startIndex + <position in this array>`, which is what
 *   lets a scroll host render a window of a list without renumbering it. See
 *   {@link Loop2#setWindow}.
 * @property {(item: any, data: any, index: number) => void} [onBuild] called after an item has been
 *   built and inserted (the "rebuild count" metric of plan/improvement-plan.md). `index` is absolute.
 * @property {(key: any, data: any, index: number, first: number) => void} [onDuplicateKey] called when
 *   a key repeats in the rendered range. The first occurrence owns the item (with the datum of the
 *   *first* occurrence); the later entry still gets its own item — keyed data never renders one datum
 *   twice — but that item owns no key, so it is matched by index from then on. Once per key per
 *   reconciliation; defaults to a `console.warn`. The signature matches `@jsx6/virtual-scroll`'s
 *   option of the same name with `first` appended (the index whose item already owns the key).
 * @property {(item: any, data: any) => void} [onPark] called once for every item that leaves the
 *   visible range but is **kept for reuse** (a `setValue`/`setWindow` shrink, a `pop`). It is the
 *   `onItemPooled` of `@jsx6/virtual-scroll` in `Loop2`'s terms: the hook for releasing per-row
 *   resources (subscriptions, timers, media) without destroying the instance — the item keeps its
 *   nodes and its bindings and comes back through `onRestore`. A window scroll that recycles an item
 *   for an entering row reports neither, because that item never left the screen. `data` is the row
 *   the item showed *before* the pass, because the pass has already renamed it by the time a hook
 *   runs.
 * @property {(item: any, data: any) => void} [onRestore] called once for every item that re-enters
 *   the visible range, whether it was parked or is being built for the first time (`onBuild` runs
 *   first). `data` is the row it shows now.
 * @property {(item: any) => void} [onBeforeMove] called once per item whose nodes the DOM ordering is
 *   about to move, just before the `insertBefore` calls. This is the FLIP-animation hook: the item is
 *   still at its old position when it is called.
 * @property {(item: any) => void} [onAfterMove] called once per item after its nodes were moved.
 * @property {(item: any) => void} [onRelease] called after an item's bindings have been released and
 *   its node detached (`disposeItem`, `dispose`, pool eviction). Never called for a parked item —
 *   that is `onPark`.
 */

/**
 * A key extractor: the **same function shape** `@jsx6/virtual-scroll` accepts as `getKey`, so a host
 * can pass one function to both halves of a windowed list instead of keeping two key stories (and two
 * chances to disagree) in sync. `index` is the absolute index in the host's list in both packages.
 *
 * The two packages are independent: this type is a contract they both honour, not an import from one
 * into the other. Nothing here is exported — see `plan/loop2-plan.md` §5 P5.
 *
 * @typedef {(data: any, index: number) => any} KeyOf
 */

/**
 * Keyed, disposable list renderer — the v2 `Loop`.
 *
 * ```js
 * import { Loop2 } from '@jsx6/loop2'
 *
 * const loop = new Loop2({ item: Row, keyBy: row => row.id })
 * div.append(loop.el) // or let the jsx runtime insert `loop`
 * loop.setValue(rows) // reorder/insert/remove moves the existing item instances
 * ```
 *
 * The loop renders through an anchor text node (`el`), so it can be used as a child in a jsx6 or
 * `@jsx6/w` template (`h(Loop2, { item, p: 'loop' })`) and be inserted anywhere a node can.
 *
 * For a list too large to render, drive it with `setWindow(visibleSlice, startIndex)` and a finite
 * `maxPooled` — see the windowing section of the package README and `plan/loop2-plan.md` §5 P5.
 */
export class Loop2 {
  /** visible items, `allItems.slice(0, count)` */
  items = []
  /** visible items followed by the parked items kept for reuse */
  allItems = []
  /** how many entries are visible */
  count = 0
  /** the data array the loop currently renders (Loop2 owns a copy) @type {any[]} */
  data = []
  /** key → item, for visible and parked items alike @type {Map<any, any>} */
  keyMap = new Map()
  /** item → the key it owns (reverse of `keyMap`); a WeakMap so a dropped item stays collectable */
  _itemKeys = new WeakMap()
  /** item → the type it was built for; a WeakMap so a dropped item stays collectable */
  _itemTypes = new WeakMap()
  /** item → the key it was built or claimed for, kept while it is parked (the *slot* it was made
   *  for). `strictKeys` needs it to tell a slot whose key is still rendered from a free one.
   *  @type {WeakMap<any, any>} */
  _slotKeys = new WeakMap()
  /** type → the parked items of that type, in parking order; empty (and unused) without `typeBy` */
  _pools = new Map()
  /** every item the loop owns, visible or parked. `allItems` is the ordered view of it (visible
   *  first, then parked) — and `_fixItemList` uses this set to detach the nodes of the items a pass
   *  dropped, which `allItems` alone cannot see once the item left the pools
   *  @type {Set<any>} */
  _owned = new Set()
  /** item → the counter value at which it was parked, used to trim across the type pools */
  _weights = new WeakMap()
  /** monotonic counter behind `_weights` */
  _weightSeq = 0
  /** datum → the key the item built for it declared in its own template */
  _dataKeys = new WeakMap()
  /** item/node → its index in `allItems`; rebuilt by `_fixItemList(true)` @type {Map<any, number>} */
  _idx = new Map()
  _disposed = false
  /** keys already reported in the current reconciliation (`onDuplicateKey`) @type {Map<any, number>} */
  _dupes = new Map()
  /** reconciliation counter, so a duplicate key is reported once per reconciliation */
  _frame = 0
  /** how many nodes `_orderDom()` has moved since construction — the DOM-mutation metric the
   *  windowing tests assert on (`@jsx6/virtual-scroll` has no equivalent: it writes a transform) */
  domMoves = 0
  /** unsubscribe function of the watched `value` signal, kept so `dispose()` can release it
   *  @type {Function|undefined} */
  _unsubscribeValue = undefined

  /** @param {Loop2Options} [opts] */
  constructor({
    p,
    item,
    builder = Loop2Item,
    setter = setValue,
    tpl,
    value,
    primitive,
    keyBy,
    typeBy,
    maxPooled = Infinity,
    strictKeys = false,
    startIndex = 0,
    onBuild,
    onDuplicateKey,
    onPark,
    onRestore,
    onBeforeMove,
    onAfterMove,
    onRelease,
    ...itemAttr
  } = {}) {
    this.itemAttr = itemAttr
    this.isPrimitive = !!primitive
    this.builder = builder
    this.setter = setter
    this.item = item
    this.tplFunc = tpl
    this.keyBy = keyBy
    this.typeBy = typeBy
    this.maxPooled = maxPooled
    this.strictKeys = !!strictKeys
    this.startIndex = startIndex || 0
    this.onBuild = onBuild
    this.onDuplicateKey = onDuplicateKey
    this.onPark = onPark
    this.onRestore = onRestore
    this.onBeforeMove = onBeforeMove
    this.onAfterMove = onAfterMove
    this.onRelease = onRelease
    /** the anchor text node: what a template actually inserts, and what owns the loop's teardown */
    this.el = factories.Text('')
    if (value) {
      // the anchor is only reachable after the surrounding template finished building, so observing
      // on a timer is what makes `value` usable from inside a template (same reason as `Loop`)
      setTimeout(() => this._observeValue(value), 0)
    }
    addDisposer(this.el, () => this.dispose())
  }

  // -------------------------------------------------------------------------------------------
  // rendering
  // -------------------------------------------------------------------------------------------

  /** Replace the rendered data. Items are matched by key first (see `keyBy` / `$key` / `loopKey`),
   *  then by their previous index, so data without a key keeps the index-based reuse `Loop` has:
   *  the same instances stay, and only their values change.
   *
   *  Matched items are *moved*, never rebuilt, so item state, focus, scroll position and bindings
   *  survive a reorder. Items that are no longer visible are parked for reuse and are never disposed
   *  here — `disposeItem()`, `dispose()` and pool trimming are the only paths that release bindings.
   *
   *  @param {any[]} v
   */
  setValue(v) {
    // a full replacement is also a return to a full list: the index origin goes back to 0, so the
    // entry points cannot leave the loop reporting positions from an older `setWindow`
    this.startIndex = 0
    this.data = (v || []).slice()
    this._reconcile()
  }

  /** Render the visible **window** of a list the loop does not hold in full — the entry point a
   *  scroll host (`@jsx6/virtual-scroll`, or any other) drives instead of `setValue`.
   *
   *  The contract is the same as `setValue` — keyed matching, the pool, the disposal contract — with
   *  two differences that make windowing correct:
   *
   *  1. `startIndex` is the **absolute** index of `v[0]` in the host's list, and it becomes the loop's
   *     index origin: `keyBy(data, i)`, `onBuild(item, data, i)`, the item's `attr.i`, the node
   *     stamps and `onDuplicateKey` all report `startIndex + <position in v>` — the same index the
   *     host uses for row `i`'s position. `loopIndex` stays the *relative* index, because that is the
   *     `getItemIndex`/`removeItem` addressing the rest of the API uses.
   *  2. `v` is treated as the whole visible set, so the loop renders exactly the slice it is given.
   *     With `maxPooled` at the window size (plus its overscan) the loop's node count stays bounded
   *     no matter how large the host's list is.
   *
   *  Windowing needs **keys** (`keyBy`, or `$key`/`loopKey` on the data): with data that has no key
   *  the loop falls back to index-based reuse, and a slice of a slice renumbers those rows. The
   *  mutation API (`push`/`pop`/`splice`/`setItem`/`moveItem`) refuses a windowed loop for the same
   *  reason: the host owns the data.
   *
   *  Typical host loop — one line, no per-row state invented by the host:
   *
   *  ```js
   *  const onScroll = () => {
   *    const [start, end] = windowOf(scrollTop) // the host's own range math
   *    loop.setWindow(rows.slice(start, end), start)
   *  }
   *  ```
   *
   *  @param {any[]} v the visible slice, in list order
   *  @param {number} [startIndex] the absolute index of `v[0]`; must be a non-negative integer
   *  @returns {this}
   */
  setWindow(v, startIndex = 0) {
    if (!Array.isArray(v)) throw new TypeError('Loop2.setWindow: expected an array of data')
    if (!Number.isInteger(startIndex) || startIndex < 0) {
      throw new RangeError(`Loop2.setWindow: startIndex must be a non-negative integer, got ${startIndex}`)
    }
    // snapshot before the swap, so a pass that throws can put the loop back where it was
    const previousData = this.data
    const previousStart = this.startIndex
    this.startIndex = startIndex
    this.data = v.slice()
    try {
      this._reconcile(previousData, previousStart)
    } catch (err) {
      this.data = previousData
      this.startIndex = previousStart
      throw err
    }
    return this
  }

  /** The window the loop currently renders: `[startIndex, startIndex + count)` in the host's
   *  absolute indexing. An empty loop reports an empty range at the current origin.
   *
   *  @returns {[number, number]}
   */
  getWindow() {
    return [this.startIndex, this.startIndex + this.count]
  }

  /** Guard the mutation API against a windowed loop: `push`/`pop`/`splice`/`setItem`/`moveItem`
   *  would edit the window's slice while the host owns the real list, and report absolute positions
   *  that mean nothing outside it. Failing loudly beats a silently wrong index.
   *
   *  @param {string} method
   */
  _refuseWindowed(method) {
    if (this.startIndex === 0) return
    throw new Error(
      `Loop2.${method}() cannot be used while the loop renders a window (origin ${this.startIndex}); ` +
        `the host owns the data — edit your list and call setWindow(slice, startIndex) again`,
    )
  }

  /** The reconciliation algorithm, shared by every mutation.
   *
   *  Passes: (1) a datum that declares a key claims the item that owns that key; (2) unkeyed data
   *  keeps the item at its previous index; (3) a parked item, or a freshly built one, fills what is
   *  left. Then values are written once per item, keys are re-bound first-occurrence-wins, the DOM is
   *  attached/ordered and the pool is trimmed.
   *
   *  The body runs inside a `try/finally`: whatever a user callback throws (a builder, a setter, a
   *  hook), the loop still ends up with every item it built accounted for — visible or parked, nodes
   *  attached or detached — instead of leaving orphaned nodes in the DOM (the invariant
   *  `@jsx6/virtual-scroll` enforces with the same technique). A throw also rolls the pass back as a
   *  whole: the data and the index origin return to the state before it, exactly like the DOM.
   *
   *  @param {any[]} [previousData] the data to fall back to when the pass throws (`setWindow` hands
   *    in what it replaced; the mutations that keep `data` in place need no argument)
   *  @param {number} [previousStart] the index origin to fall back to
   */
  _reconcile(previousData, previousStart = 0) {
    const v = this.data || []
    const n = v.length
    const all = this.allItems
    /** the state a throw has to fall back to: the pass must not change what is rendered */
    const previous = all.slice()
    const previousVisible = new Set(this.items)
    const previousKeys = new Map(this.keyMap)
    const start = this.startIndex
    /** the visible items of the state this pass replaces — the pass renames the items it recycles,
     *  so the snapshot has to be the *array*, not a set read after the pass */
    const visibleBefore = this.items.slice()
    /** item → the row it showed before the pass, for the `onPark` report (see `_rowId`) */
    const rowIdsBefore = new WeakMap()
    for (const item of visibleBefore) rowIdsBefore.set(item, this._rowId(item))
    /** item that will be displayed at each visible position @type {any[]} */
    const next = Array.from({ length: n })
    /** key wanted by each datum: `keyBy`, an explicit `$key`/`loopKey`, or a learned template key */
    const wanted = Array.from({ length: n })
    /** type wanted by each datum: `typeBy`, `loopType`/`$key.type`, or the key's own type */
    const wantedTypes = Array.from({ length: n })
    /** which `wantedTypes[i]` entries have been resolved (an untyped row is resolved once, too) */
    const typesResolved = Array.from({ length: n }, () => false)
    const used = new Set()
    /** items built by this pass, in build order — the loop owns them only once it has committed */
    const created = []
    const createdSet = new Set()
    /** did the pass reach the point where it took over `next`? (the `finally` cleans up when not) */
    let reconciled = false
    this._dupes = new Map()
    this._frame++

    for (let i = 0; i < n; i++) wanted[i] = this._keyOf(v[i], start + i)

    // the key is always resolved (matching needs it); the type only when the loop can *have* types:
    // without `typeBy` a datum that is not an object cannot declare one, so a single-type list pays one
    // compare per row and never calls `_typeOf` at all
    const typeAt = i => {
      let type = wantedTypes[i]
      if (type === undefined && !typesResolved[i]) {
        // the key here is the one this pass already resolved: `keyBy` is never asked twice per row
        if (this.typeBy || isWeakKey(v[i])) type = this._typeOf(v[i], start + i, wanted[i])
        wantedTypes[i] = type
        typesResolved[i] = true
      }
      return type
    }

    /**
     * The keys that were owned *before* this pass and are no longer wanted. `strictKeys` must treat an
     * item parked under one of them as still spoken for: without this, the item that held `b` would be
     * handed to a new key `n` in the same pass that dropped `b`, which is exactly what `strictKeys`
     * forbids. Computed after pass 1, before the commit loop renames anything.
     * @type {Set<any>}
     */
    const legacyKeys = new Set()
    /**
     * The pool pass 3 draws from, grouped by type, in the loop's parking order. It contains everything
     * the loop owns: pass 2 is what speaks for the items it keeps, and an item it did not take stays
     * here for any later position. Grouping is what makes a typed lookup O(1) — a `header` position
     * reads the `header` pool, with no scan through the rows.
     * @type {Map<any, any[]>}
     */
    const pools = new Map()
    for (const item of this._owned) {
      const itemType = this._itemTypes.get(item)
      const pool = pools.get(itemType)
      if (pool) pool.push(item)
      else pools.set(itemType, [item])
    }

    try {
      // pass 1 — keyed match: a datum that declares a key claims the item that owns that key
      for (let i = 0; i < n; i++) {
        const key = wanted[i]
        if (key === undefined) continue
        const item = this.keyMap.get(key)
        if (item && !used.has(item)) {
          next[i] = item
          used.add(item)
        }
      }

      // the keys that were owned before this pass: the commit loop below renames items, so the live
      // key map can no longer tell which keys the items in the pool used to hold
      for (const item of all) {
        const key = this._slotKeys.get(item)
        if (key !== undefined && !wanted.includes(key)) legacyKeys.add(key)
      }

      // pass 2 — index fallback: data at a position keeps the item that sits at that position
      for (let i = 0; i < n; i++) {
        if (next[i]) continue
        // strictKeys: the item at this index belongs to another key, so a new key must not inherit it
        if (this.strictKeys && wanted[i] !== undefined) continue
        const item = all[i]
        if (!item || used.has(item)) continue
        // No key check is needed here, and none is made: pass 1 claims the item that owns each key the
        // list still renders, so an item that owns a wanted key is already in `used` by now. Whatever
        // is left at this index is a genuinely free slot — which is exactly the reuse `Loop` documents
        // ("the freed slot is recycled, state included"), with `strictKeys` above as the opt-out.
        // and it never crosses a type boundary: a typed row keeps asking for its own kind of item
        const type = typeAt(i)
        if (type !== undefined && this._itemTypes.get(item) !== type) continue
        next[i] = item
        used.add(item)
      }

      // pass 3 — reuse a parked item *of this row's type* (or build one), for the remaining positions
      for (let i = 0; i < n; i++) {
        if (next[i]) continue
        // `strictKeys`: a datum whose key is new must not inherit the state of another key, so only an
        // item whose old key is not one this pass still renders may be recycled
        const freeOnly = this.strictKeys && wanted[i] !== undefined
        const parked = this._takeFree(typeAt(i), used, legacyKeys, pools, freeOnly)
        if (parked) {
          next[i] = parked
          continue
        }
        // the type is resolved first, so it is handed to the builder instead of `makeItem` asking for
        // the key again (`keyBy` is called once per row per pass)
        const type = typeAt(i)
        const built = this.makeItem(v[i], start + i, type)
        next[i] = built
        created.push(built)
        createdSet.add(built)
        this._owned.add(built)
        // `makeItem()` recorded the key the item's own template declared for this datum
        if (wanted[i] === undefined) wanted[i] = this._itemKeys.get(built)
        if (type === undefined) {
          // the key may carry the type even when the datum does not
          const resolved = keyValue(this._itemKeys.get(built))
          if (isWeakKey(resolved) && hasType(resolved.type)) wantedTypes[i] = resolved.type
          typesResolved[i] = true
        }
      }

      // `next` is the new visible order; where the leftovers live is the pools' business (see
      // `_finishPass`), so the commit only has to record the visible half of the state
      this.count = n
      reconciled = true

      const claimedKeys = new Map()
      for (let i = 0; i < n; i++) {
        const item = next[i]
        // an item reused by index keeps the key it was built/claimed with (its element key is frozen
        // anyway); a datum with a key always wins
        const wantedKey = wanted[i]
        let key = wantedKey === undefined ? this._itemKeys.get(item) : wantedKey
        if (key !== undefined) {
          const first = claimedKeys.get(key)
          if (first !== undefined) {
            // duplicate key: the first occurrence owns it, this item is matched by index from now on
            this._duplicate(key, v[i], start + i, first)
            key = undefined
          } else {
            claimedKeys.set(key, start + i)
          }
        }
        if (!createdSet.has(item)) this._bindItem(item, v[i], start + i)
        if (key !== undefined) this._setItemKey(item, key)
        // the type decides which pool this item may be reused from later; a built item already has it
        this._setItemType(item, typeAt(i))
      }
    } finally {
      // a builder, setter or hook that threw must not leave a half-built item in the DOM: an aborted
      // pass never took over the items it built, so those are released here and the previous visible
      // set is restored. (After a completed pass they are the visible items — releasing them would
      // empty the list.)
      if (!reconciled) {
        for (const item of created) this._releaseItem(item)
        created.length = 0
        this.allItems = previous
        this.count = previousVisible.size
        // the pass never took over the data it was asked to render either, so `getWindow()`,
        // `getData()` and the next report all describe what the loop still shows
        if (previousData) {
          this.data = previousData
          this.startIndex = previousStart
        }
        // `makeItem()` registered the key a built item declared; the pass never took it over, so the
        // previous owners get their keys back (releasing the built items dropped theirs)
        this.keyMap = previousKeys
        // and `next` is not an order to commit — put the previous visible items back instead
        this.items = previous.slice(0, this.count)
        this.allItems = previous
        this._fixItemList(true)
        this._enforcePoolLimit()
      }
    }
    // only a completed pass has an order worth committing; the aborted one has just restored state
    if (reconciled) this._finishPass(next)
    this._reportVisibility(visibleBefore, rowIdsBefore)
  }

  /** Update or create the item that displays `newData` at position `i`, then make the list
   *  consistent again.
   *
   *  Unlike `@jsx6/jsx6`'s `Loop`, an index one past the end **grows** the list (it does not create
   *  a hole) and anything beyond that throws, because a hole is a state `_fixItemList` never
   *  supported (plan/keyed-loop-design.md §7.8).
   *
   *  This is an explicit in-place instruction: it rebinds the item at `i` to the new datum even when
   *  `strictKeys` is on (the caller asked for that position). Use `setValue`/`splice` for keyed
   *  matching.
   *
   *  @param {any} newData
   *  @param {number} i 0-based visible position, `0..count`
   *  @returns {any} the item now at position `i`
   */
  setItem(newData, i) {
    this._refuseWindowed('setItem')
    if (typeof i !== 'number' || i < 0 || i > this.count) {
      throw new RangeError(`Loop2.setItem: index ${i} is outside 0..${this.count}`)
    }
    const visibleBefore = this.items.slice()
    const rowIdsBefore = new WeakMap()
    for (const item of visibleBefore) rowIdsBefore.set(item, this._rowId(item))
    const abs = this.startIndex + i
    let item = this.allItems[i]
    try {
      if (!item) item = this.allItems[i] = this.items[i] = this.makeItem(newData, abs)
      else this._bindItem(item, newData, abs)
      if (i === this.count) this.data.push(newData)
      else this.data[i] = newData
      this.count = Math.max(this.count, i + 1)
      // bind the datum's key even for a freshly built item: `_learnKey` only knows the key sources
      // the item template and the datum carry, not `keyBy`
      this._claimKey(item, this._keyOf(newData, abs))
      this._setItemType(item, this._typeOf(newData, abs))
    } finally {
      this._commit()
    }
    this._reportVisibility(visibleBefore, rowIdsBefore)
    return item
  }

  /** Append one entry: O(1) for unkeyed data (the common case), a full reconciliation when the
   *  datum's key belongs to an item parked somewhere else in the pool.
   *
   *  @param {any} data
   *  @returns {any} the item at the new last position
   */
  push(data) {
    this._refuseWindowed('push')
    const i = this.count
    const abs = this.startIndex + i
    const key = this._keyOf(data, abs)
    const owner = key === undefined ? undefined : this.keyMap.get(key)
    // fast path: the append slot already holds the item this datum would be matched with
    if (key !== undefined && owner !== this.allItems[i]) {
      this.data.push(data)
      this._reconcile()
      return this.items[i]
    }
    const visibleBefore = this.items.slice()
    const rowIdsBefore = new WeakMap()
    for (const item of visibleBefore) rowIdsBefore.set(item, this._rowId(item))
    let item = this.allItems[i]
    const created = !item
    try {
      if (created) item = this.allItems[i] = this.items[i] = this.makeItem(data, abs)
      else this._bindItem(item, data, abs)
      this.data.push(data)
      this.count = i + 1
      if (key !== undefined) this._claimKey(item, key)
      this._setItemType(item, this._typeOf(data, abs))
    } finally {
      this._commit()
    }
    this._reportVisibility(visibleBefore, rowIdsBefore)
    return item
  }

  /** Remove the last visible entry. The item is only detached and stays in the reuse pool (with its
   *  state and its key), so a later `push()` of the same key reuses that instance; use
   *  `disposeItem()` to release it for good.
   *
   *  @returns {any} the removed item, or undefined when the loop was empty
   */
  pop() {
    this._refuseWindowed('pop')
    if (this.count === 0) return undefined
    const visibleBefore = this.items.slice()
    const rowIdsBefore = new WeakMap()
    for (const item of visibleBefore) rowIdsBefore.set(item, this._rowId(item))
    const item = this.allItems[this.count - 1]
    this.data.pop()
    this.count--
    this._commit()
    this._reportVisibility(visibleBefore, rowIdsBefore)
    return item
  }

  /** Array-style edit of the rendered data, followed by one reconciliation.
   *
   *  @param {number} index
   *  @param {number} [deleteCount]
   *  @param {...any} toAdd
   *  @returns {any[]} the removed **data** entries (Array#splice semantics). The item *instances*
   *    that showed them are parked for reuse, not returned; find them with `getItemByKey()`.
   */
  splice(index, deleteCount = 0, ...toAdd) {
    this._refuseWindowed('splice')
    const removed = this.data.splice(index, deleteCount, ...toAdd)
    this._reconcile()
    return removed
  }

  /** Move the entry at `fromIndex` so that it sits before the entry the caller saw at
   *  `insertBefore` (`Loop`'s semantics, including "`insertBefore` refers to the index in the
   *  original order"); a negative or past-the-end `insertBefore` moves it to the end.
   *
   *  @param {number} fromIndex
   *  @param {number} insertBefore
   *  @returns {any} the moved datum
   */
  moveItem(fromIndex, insertBefore) {
    this._refuseWindowed('moveItem')
    const moved = this.data.splice(fromIndex, 1)[0]
    let to = fromIndex < insertBefore ? insertBefore - 1 : insertBefore
    if (!(to >= 0) || to > this.data.length) to = this.data.length
    this.data.splice(to, 0, moved)
    this._reconcile()
    return moved
  }

  /** Remove one visible entry (its item is parked for reuse, see `pop`).
   *
   *  @param {any} item item instance, its index, its node, or a function resolving to it
   *  @throws when the item is not a visible entry of this loop — a parked instance is not
   *    removable this way, release it with `disposeItem()`
   */
  removeItem(item) {
    const index = this.getItemIndex(item)
    if (index === -1 || index === undefined || index < 0 || index >= this.count) {
      throwErr(JSX6E12_ITEM_NOT_FOUND, item)
    }
    this.splice(index, 1)
  }

  // -------------------------------------------------------------------------------------------
  // keys
  // -------------------------------------------------------------------------------------------

  /** The type the item currently owns, or `undefined` for an untyped item.
   *
   *  @param {any} item
   *  @returns {any}
   */
  typeOf(item) {
    return this._itemTypes.get(item)
  }

  /** Ignore every parked item whose type is *not* in `types`, releasing them for good. `0` counts as
   *  untyped, exactly like everywhere else.
   *
   *  This is the one call a windowed host needs for a list that mixes row types: a window renders the
   *  types it contains, and everything the loop parked under a type the new window does not have
   *  keeps `maxPooled` slots busy for nothing. Ungrouped loops skip all of it.
   *
   *  @param {Iterable<any>} types the types the host is about to render
   *  @returns {number} how many items were released
   */
  keepTypes(types) {
    if (!this._pools.size) return 0
    const kept = new Set()
    for (const type of types) if (hasType(type)) kept.add(type)
    let released = 0
    for (const [type, items] of [...this._pools]) {
      if (kept.has(type)) continue
      for (const item of items) {
        this._releaseItem(item)
        released++
      }
      this._pools.delete(type)
    }
    if (released) this._fixItemList(true)
    return released
  }

  /** Take the item from the pass's pool that a position of this type should reuse, or `undefined`.
   *
   *  A typed position only ever takes an item of its own type: that is what keeps a row from
   *  inheriting the state, the DOM node and the shape of an unrelated row. An untyped position takes
   *  anything, which is the pre-`typeBy` behaviour (single slot, no grouping).
   *
   *  `strictKeysOnly` narrows it further (`strictKeys`): an item parked under a key this pass dropped
   *  (`legacyKeys`) is still spoken for by that key, so only an item whose old key is gone may be
   *  recycled — otherwise the item that held `b` would be handed to a brand-new key `n` in the very
   *  pass that dropped `b`.
   *
   *  The pool is in parking order and the **oldest** item goes first, so the common case checks its head
   *  and only scans when that one is spoken for (`used`) or rejected by `strictKeys`.
   *
   *  @param {any} type the type the position needs (`undefined` = untyped)
   *  @param {Set<any>} used the items this pass has already claimed (by key, by index or by reuse)
   *  @param {Set<any>} legacyKeys keys this pass dropped (still owned by the items parked under them)
   *  @param {Map<any, any[]>} [pools] the pool to draw from
   *  @param {boolean} [strictKeysOnly] reject an item whose old key is in `legacyKeys`
   *  @returns {any} the item, or undefined when no parked item qualifies
   */
  _takeFree(type, used, legacyKeys, pools = this._pools, strictKeysOnly = false) {
    /** @type {any[]|undefined} */
    let owner
    if (type !== undefined) {
      // a typed position is served by its own pool only
      owner = pools.get(type)
      if (!owner || owner.length === 0) return undefined
    } else if (pools.size === 1) {
      // the single-slot case (a list without `typeBy`): the only pool, with no scan to find it
      owner = pools.values().next().value
      if (!owner || owner.length === 0) return undefined
    } else {
      // an untyped position takes the first parked item of any type: the pre-`typeBy` behaviour
      for (const pool of pools.values()) {
        if (pool.length) {
          owner = pool
          break
        }
      }
      if (!owner) return undefined
    }
    /** the pool holds item objects; a primitive here means the pool itself is corrupt */
    const free = item => isWeakKey(item) && !used.has(item)
    const at =
      strictKeysOnly || !free(owner[0])
        ? owner.findIndex(item => free(item) && !legacyKeys.has(this._slotKeys.get(item)))
        : 0
    if (at === -1) return undefined
    const takenItem = owner.splice(at, 1)[0]
    used.add(takenItem)
    return takenItem
  }

  /** Hand a pass over to the loop: the visible items in order, then the normal commit path
   *  (`_fixItemList` rebuilds `allItems` and the pools from them). The multi-item mutations go
   *  through here so no path can leave a different view of what the loop owns; the single-item ones
   *  update `allItems`/`items` in place and call `_fixItemList` directly.
   *
   *  @param {any[]} next the item for each visible position
   */
  _finishPass(next) {
    this.count = next.length
    this.allItems = next.slice()
    this._fixItemList(true)
    this._enforcePoolLimit()
  }

  /** Keep `items` and the pools consistent with `allItems` after `count` or the order changed. */
  _commit() {
    this.items = this.allItems.slice(0, this.count)
    this._fixItemList(true)
    this._enforcePoolLimit()
  }

  /** Split what the loop owns into the visible items (in the order the pass decided) and the parked
   *  ones, grouped by type. Anything the pass neither put on screen nor parked back becomes
   *  unpositioned, and `_fixItemList()` detaches its nodes.
   *
   *  @param {any[]} visible the item for each visible position
   */
  _partition(visible) {
    const pools = new Map()
    const placed = new Set(visible)
    for (const item of this._owned) {
      if (placed.has(item)) continue
      const type = this._itemTypes.get(item)
      const pool = pools.get(type)
      if (pool) pool.push(item)
      else pools.set(type, [item])
    }
    return pools
  }

  /** Key that drives matching for one datum, in priority order: `keyBy`, the datum's own
   *  `$key`/`loopKey`, the key its item declared when it was built. `undefined` = unkeyed.
   *
   *  `i` is the **absolute** index (`startIndex + position`), the same index the item template and
   *  `onBuild` see, so one `keyBy` can serve a normal loop and a windowed one unchanged.
   *
   *  @param {any} data
   *  @param {number} i absolute index
   *  @returns {any}
   */
  _keyOf(data, i) {
    const keyBy = this.keyBy
    if (keyBy) {
      const by = keyValue(keyBy(data, i))
      if (by !== undefined && by !== null) return by
    }
    const key = dataKey(data)
    if (key !== undefined) return key
    return isWeakKey(data) ? this._dataKeys.get(data) : undefined
  }

  /** Type that drives the reuse slot for one datum, in priority order: `typeBy`, the datum's own
   *  `loopType`/`$key.type`, the type of the key `keyBy` returned. `undefined` = untyped, which is
   *  also what every datum is without `typeBy`.
   *
   *  Like the key, `i` is the absolute index. `key` is the already-resolved key of the same datum,
   *  so this never asks the app's `keyBy` twice for one row.
   *
   *  @param {any} data
   *  @param {number} i absolute index
   *  @param {any} [key] the datum's key; when it is not known, the key-derived type is skipped (an
   *    already-resolved key is never looked up a second time)
   *  @returns {any}
   */
  _typeOf(data, i, key) {
    const typeBy = this.typeBy
    if (typeBy) {
      const by = keyValue(typeBy(data, i))
      if (hasType(by)) return by
    }
    const declared = dataType(data)
    if (declared !== undefined) return declared
    if (key === undefined) return undefined
    // the last resort is the type the key itself declares (`keyBy: r => ({ id: r.id, type: r.kind })`)
    const resolved = keyValue(key)
    return isWeakKey(resolved) && hasType(resolved.type) ? resolved.type : undefined
  }

  /** Make `item` the owner of a type, so it can only ever be reused for that type. */
  _setItemType(item, type) {
    if (!isWeakKey(item)) {
      console.error('Loop2: item is not an object', item, new Error().stack)
      return
    }
    this._itemTypes.set(item, type)
  }

  /** Report a key that repeats in the rendered range, once per key per reconciliation — a
   *  scroll-driven window (or a `setValue` in a rAF) must not repeat the report every frame.
   *  The stamp is written *before* the reporter runs, so a throwing reporter cannot turn into a
   *  per-frame log either; `_dupes` is reset at the start of every reconciliation.
   *
   *  @param {any} key
   *  @param {any} data the later datum
   *  @param {number} index its absolute index
   *  @param {number} first the absolute index whose item already owns the key
   */
  _duplicate(key, data, index, first) {
    if (this._dupes.has(key)) return
    this._dupes.set(key, index)
    if (this.onDuplicateKey) this.onDuplicateKey(key, data, index, first)
    else {
      console.warn(
        `Loop2: duplicate key ${String(key)} at index ${index} — index ${first} already used it, ` +
          `the later item is not keyed (item keys must be unique)`,
      )
    }
  }

  /** Read the key a freshly built item declared for `data` (its own `$key`/`loopKey`, or the
   *  `loopKey` of its root element) and remember it for that datum object. */
  _learnKey(item, data) {
    const key = dataKey(data) ?? itemKey(item)
    if (key === undefined || key === null) return undefined
    if (isWeakKey(data)) this._dataKeys.set(data, key)
    this._setItemKey(item, key)
    return key
  }

  /** Make `item` the owner of `key`, or drop its key when `key` is nullish. The key is also
   *  remembered as the item's *slot* (`_slotKeys`), which survives parking: that is what lets
   *  `strictKeys` recognise that a parked item's old key is still rendered by someone else. */
  _setItemKey(item, key) {
    // the slot a *released* item had is irrelevant, so only a real key is remembered as its slot
    if (key !== undefined && key !== null) this._slotKeys.set(item, key)
    const prev = this._itemKeys.get(item)
    if (prev !== undefined && prev !== key && this.keyMap.get(prev) === item) this.keyMap.delete(prev)
    if (key === undefined || key === null) {
      this._itemKeys.delete(item)
      return
    }
    const owner = this.keyMap.get(key)
    if (owner && owner !== item) this._itemKeys.delete(owner)
    this.keyMap.set(key, item)
    this._itemKeys.set(item, key)
  }

  /** Bind `item` to `key`, unless a *visible* item already owns that key: a duplicate key never
   *  steals the entry of an earlier one. Used by the one-entry mutations, which must not silently
   *  rearrange the list; `_reconcile` does its own first-occurrence-wins bookkeeping. */
  _claimKey(item, key) {
    if (!item || key === undefined || key === null) return
    const owner = this.keyMap.get(key)
    if (owner === item) return
    if (owner) {
      const at = this.getItemIndex(owner)
      if (at !== -1 && at < this.count) return
      this._setItemKey(owner, undefined)
    }
    this._setItemKey(item, key)
  }

  /** The item registered under `key` — visible, or parked in the reuse pool.
   *
   *  @param {any} key
   *  @returns {any}
   */
  getItemByKey(key) {
    return this.keyMap.get(key)
  }

  /** The key the item currently owns, or `undefined`.
   *
   *  @param {any} item
   *  @returns {any}
   */
  getKey(item) {
    return this._itemKeys.get(item)
  }

  // -------------------------------------------------------------------------------------------
  // item lifecycle
  // -------------------------------------------------------------------------------------------

  /** Write the absolute index onto every node an item renders — `$i`, the value
   *  `@jsx6/virtual-scroll` keeps as `__vsIndex` for the same purpose. Kept current on every bind,
   *  which the builder options' `i` (frozen at build time) cannot be.
   *
   *  @param {any} item
   *  @param {number} i absolute index
   */
  _stampIndex(item, i) {
    const el = toDomNode(item)
    if (el instanceof Array) {
      for (const node of el) if (node && node.nodeType && node.$i !== i) node.$i = i
    } else if (el && el.nodeType && el.$i !== i) el.$i = i
  }

  /** Write one datum into one item: the index stamp first, then the configured setter. Shared by
   *  every path that keeps an existing item, so no mutation can disagree about the index.
   *
   *  @param {any} item
   *  @param {any} data
   *  @param {number} i absolute index
   */
  _bindItem(item, data, i) {
    this._stampIndex(item, i)
    this.setter(item, data, i)
  }

  /**
   * Build, set up and insert one item. The item's own template may declare its key
   * (`key={value.id}`), which is read here — the only moment it is still meaningful.
   *
   * `i` is the **absolute** index. It reaches the item as the builder options' `i` (and `attr.i`,
   * written before the builder runs), it is written onto the item's nodes by `_bindItem()` as `$i`
   * on every later bind, and `_fixItemList()` stamps `loopIndex` (relative) and `__loop2Index`
   * (absolute) on them. `type` is the type the item is built for, and it is what keeps the item in
   * its own reuse pool from then on.
   *
   * A builder that returns nothing (and a setter that then throws) cannot leave a stray node behind:
   * whatever was inserted is removed and the item is released before the error propagates.
   *
   * @param {any} data
   * @param {number} i absolute index
   * @param {any} [type] the type this item is built for (`undefined` = untyped)
   * @returns {any} the built item
   */
  makeItem(data, i, type) {
    const { builder, setter } = this
    // the caller (a reconciliation) resolves the type from the key it already has; a direct
    // `makeItem` call resolves it here. Only a loop that can *have* types is asked: without `typeBy`
    // a key that is not an object cannot carry one, so nothing is computed (and `keyBy` is not called
    // a second time for a row an untyped loop does not care about).
    if (type === undefined && (this.typeBy || isWeakKey(data))) type = this._typeOf(data, i)
    /** @type {Record<string, any>} */
    const attr = { ...this.itemAttr, i }
    const comp = builder({
      data,
      i,
      type,
      loop: this,
      tpl: this.tplFunc,
      item: this.item,
      primitive: this.isPrimitive,
      attr,
    })
    if (!comp) {
      throw new TypeError(
        'Loop2: the item builder returned nothing — it must return a component or an item object ' +
          '(the default builder is Loop2Item; a custom one has to return what it was handed or build its own)',
      )
    }
    try {
      setter(comp, data, i)
      // the *resolved* nodes, not the component: an item template may render a fragment (an array of
      // nodes), and `insert()`/`forInsert()` unwraps `.el` only when that is a single node
      this.insert(toDomNode(comp))
    } catch (err) {
      for (const node of nodesOf(comp)) if (node.parentNode) node.parentNode.removeChild(node)
      this._releaseItem(comp)
      throw err
    }
    this._learnKey(comp, data)
    this._setItemType(comp, type)
    this._stampIndex(comp, i)
    if (this.onBuild) this.onBuild(comp, data, i)
    return comp
  }

  /**
   * Report which items entered and left the visible range, through `onRestore` and `onPark`.
   *
   * `onRestore` runs before `onPark`. An item a pass merely *renamed* — a recycled window row — is in
   * both sets and is reported as neither: it never left the screen. Each hook receives the item and
   * the datum **value** it shows; for `onPark` that is the row the item displayed *before* the pass,
   * because the pass has already renamed it by the time the hook runs.
   *
   * Every hook error is collected so the reporting finishes (a throwing app hook cannot make the
   * other transitions invisible), and the first one is rethrown afterwards, exactly like
   * `@jsx6/virtual-scroll`'s `recycleElements()`.
   *
   * @param {any[]} before the visible items of the previous state
   * @param {WeakMap<any, any>} rowIds for each of those items, the row it showed before the pass
   */
  _reportVisibility(before, rowIds) {
    const after = this.items
    const beforeSet = new Set(before)
    const afterSet = new Set(after)
    const { onPark, onRestore } = this
    if (!onPark && !onRestore) return
    /** @type {unknown} */
    let failure
    const call = (hook, item, data) => {
      try {
        hook(item, data)
      } catch (err) {
        if (!failure) failure = err
      }
    }
    if (onRestore)
      for (const item of after) if (!beforeSet.has(item)) call(onRestore, item, this._rowId(item))
    if (onPark) for (const item of before) if (!afterSet.has(item)) call(onPark, item, rowIds.get(item))
    if (failure) throw failure
  }

  /** The datum value an item renders right now — the second argument of `onPark`/`onRestore`.
   *
   *  A hook fires *after* the pass has renamed the items it recycled, so `item.getValue()` no longer
   *  describes the row an item held before the pass; the loop hands the hook that row's value
   *  explicitly instead (for `onPark`, from the snapshot taken when the pass started). */
  _rowId(item) {
    try {
      const value = item.getValue()
      return typeof value === 'function' ? value() : value
    } catch {
      return undefined
    }
  }

  /** Insert a node/item relative to the loop anchor. A no-op while the loop is not attached yet —
   *  `refresh()` (or any later mutation) inserts everything that is missing. */
  insert(el, before) {
    const parent = this.el.parentNode
    if (!parent) return
    insert(parent, el, before || this.el)
  }

  /** Release an item for good: its key, its bindings (`disposeNode`) and its nodes.
   *
   *  @param {any} item
   *  @param {boolean} [detach] detach the nodes as well (false inside `dispose()`)
   */
  _releaseItem(item, detach = true) {
    if (!item) return
    this._setItemKey(item, undefined)
    this._owned.delete(item)
    this._weights.delete(item)
    this._idx.delete(item)
    disposeNode(toDomNode(item))
    if (detach) {
      for (const node of nodesOf(item)) {
        this._idx.delete(node)
        if (node.parentNode) node.parentNode.removeChild(node)
      }
    }
    if (this.onRelease) this.onRelease(item)
  }

  /** Permanently remove one item: release its bindings, drop it from `allItems` so it can never be
   *  reused, and detach its node. The only eviction path that disposes (see `pop`, `splice`).
   *
   *  A visible item also removes its data entry, so the rendered data and `allItems` stay in step.
   *
   *  @param {any} item item instance, its index, its node, or a function resolving to it
   *  @returns {any} the disposed item, or undefined when it is not part of the loop
   */
  disposeItem(item) {
    const index = this.getItemIndex(item)
    if (index === -1 || index === undefined || index < 0 || index >= this.allItems.length) {
      return undefined
    }
    const [removed] = this.allItems.splice(index, 1)
    if (index < this.count) {
      this.count--
      this.data.splice(index, 1)
    }
    this._releaseItem(removed)
    this._fixItemList(true)
    return removed
  }

  /** Release parked items beyond `keep`, returning how many were released.
   *
   *  The reuse pool is what makes remove/re-add cheap, but `Loop` keeps every item it has ever
   *  built. With a finite `maxPooled` the loop disposes the items it no longer shows: state that
   *  would have been reused is lost, the memory is not.
   *
   *  `keep` is the **total** across the type pools: the least recently parked items go first, so no
   *  one type can hold the whole budget while another starves. A `keep` of `0` is the "reclaim now"
   *  call — with `typeBy` it is what a windowed host uses to drop the items of the types its window
   *  no longer renders (see `keepTypes`, which is the same idea expressed by type).
   *
   *  @param {number} [keep] parked items to keep, defaults to `maxPooled`
   *  @returns {number}
   */
  releasePool(keep = this.maxPooled) {
    if (keep !== 0 && !keep) return 0
    const parked = this.allItems.length - this.count
    if (parked <= keep) return 0
    // typed pools hold the parking order in a weak map (their array order is per type); an untyped
    // loop is one pool whose array order *is* the parking order — newest last — so both end up as a
    // "least recently parked first" list without paying for bookkeeping the untyped path never needs
    const ordered = this._pools
    const items = [...ordered.values()].flat()
    if (this.typeBy) items.sort((a, b) => this._weightOf(a) - this._weightOf(b))
    else items.reverse()
    let released = 0
    for (const item of items) {
      if (parked - released <= keep) break
      this._releaseItem(item)
      released++
    }
    if (released) this._fixItemList(true)
    return released
  }

  /** The parking order of a parked item, assigned on first ask. Only the typed path calls this: a
   *  single-pool loop has its order in `allItems` and needs no counter. */
  _weightOf(item) {
    let weight = this._weights.get(item)
    if (weight === undefined) {
      weight = ++this._weightSeq
      this._weights.set(item, weight)
    }
    return weight
  }

  /** Trim every type pool to `maxPooled` in total (a no-op with the default `Infinity`). */
  _enforcePoolLimit() {
    const limit = this.maxPooled
    if (limit === Infinity || limit === undefined || limit === null) return 0
    return this.releasePool(limit)
  }

  /** Remove the loop for good: the value subscription and the bindings of every item, including the
   *  hidden ones kept for reuse. Called automatically when the anchor node is disposed, which is
   *  what `remove()` / `replace()` of any ancestor of the loop does. Idempotent; does not detach
   *  nodes (like the rest of `disposeNode()`). */
  dispose() {
    if (this._disposed) return this
    this._disposed = true
    const unsubscribe = this._unsubscribeValue
    this._unsubscribeValue = undefined
    if (unsubscribe) unsubscribe()

    const items = this.allItems
    this.allItems = []
    this.items = []
    this.count = 0
    this.data = []
    for (const item of items) this._releaseItem(item, false)

    this.keyMap.clear()
    this._itemKeys = new WeakMap()
    this._dataKeys = new WeakMap()
    this._itemTypes = new WeakMap()
    this._pools = new Map()
    this._weights = new WeakMap()
    this._idx.clear()

    disposeNode(this.el)
    return this
  }

  /** Subscribe to the `value` option, keeping the unsubscribe function so `dispose()` can release
   *  it. Split out of the constructor because the observation is deferred to a timer. */
  _observeValue(value) {
    if (this._disposed) return
    const unsubscribe = observeNow(value, v => this.setValue(v))
    if (!unsubscribe) return
    if (this._disposed) {
      // disposed between scheduling and running the timer
      unsubscribe()
    } else {
      this._unsubscribeValue = unsubscribe
      addDisposer(this.el, unsubscribe)
    }
  }

  // -------------------------------------------------------------------------------------------
  // DOM
  // -------------------------------------------------------------------------------------------

  /** Refresh `items`, stamp positions, attach/detach and re-order the DOM. Called after every
   *  structural change.
   *
   *  Items at `i >= count` are only detached — never disposed — because they stay in `allItems` for
   *  reuse (see the "Loop reuse caveat" in plan/disposal-design.md). That invariant (every item is
   *  visible or parked) is what makes windowing safe: a scroll can park and restore without ever
   *  losing track of a node.
   *
   *  Every node gets two stamps: `loopIndex`, the **relative** index in `allItems` — the addressing
   *  `getItemIndex()`/`removeItem()`/`setItem()` use — and `__loop2Index`, the **absolute** index
   *  (`startIndex + i`), the one that identifies the row in the host's list. */
  _fixItemList(reindex) {
    const count = this.count
    this.items = this.allItems.slice(0, count)
    if (reindex) {
      // one order, one set of pools: the visible items, then everything the loop owns but does not
      // show (grouped by type, in parking order). Rebuilding from `_owned` is what keeps `allItems`,
      // `items` and the pools from ever disagreeing about which items the loop owns — the visible
      // array alone would lose the items this pass parked.
      this._pools = this._partition(this.items)
      const parked = []
      for (const pool of this._pools.values()) parked.push(...pool)
      const next = this.items.concat(parked)
      // an item the pass dropped from both the visible set and the pools is still owned (it holds
      // its node and its bindings) but has no position: detach its nodes, or they stay in the DOM
      const placed = new Set(next)
      for (const item of this._owned) {
        if (placed.has(item)) continue
        for (const node of nodesOf(item)) if (node.parentNode) node.parentNode.removeChild(node)
      }
      this.allItems = next
    }
    if (!reindex) return
    const all = this.allItems
    const parent = this.el.parentNode
    const start = this.startIndex
    this._idx = new Map()
    for (let i = 0; i < all.length; i++) {
      const item = all[i]
      if (!item) continue
      const el = toDomNode(item)
      const nodes = nodesOf(item)
      const abs = start + i
      this._idx.set(item, i)
      if (el && el !== item) this._idx.set(el, i)
      if (el) el.loopIndex = i
      else item.loopIndex = i
      item.__loop2Index = abs
      // stamping every node (not just the first) is what makes `getItemIndex(node)` work for an
      // item template that rendered a fragment
      for (const node of nodes) {
        node.loopIndex = i
        node.__loop2Index = abs
        this._idx.set(node, i)
      }
      if (i < count) {
        if (parent && nodes.some(node => node.parentNode !== parent)) this.insert(el)
      } else {
        for (const node of nodes) if (node.parentNode) node.parentNode.removeChild(node)
      }
    }
    this._orderDom()
  }

  /** Put the visible item nodes in `items` order. `_fixItemList()` has already attached every
   *  visible item and detached the parked ones, so only the order can be wrong.
   *
   *  Walks backwards, anchoring each item directly before the next one (the last before the loop's
   *  anchor text node), and touches the DOM only when an item is not already in place — an unchanged
   *  list performs **no** DOM mutation, and a rotation of 3 items performs 2 `insertBefore` calls.
   *  Only the items whose nodes actually move reach `onBeforeMove`/`onAfterMove`, once each. */
  _orderDom() {
    const parent = this.el.parentNode
    if (!parent) return
    const items = this.items
    let before = this.el
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]
      const nodes = nodesOf(item)
      if (!nodes.length) continue
      const last = nodes[nodes.length - 1]
      if (last.parentNode !== parent || last.nextSibling !== before) {
        if (this.onBeforeMove) this.onBeforeMove(item)
        for (const node of nodes) parent.insertBefore(node, before)
        this.domMoves++
        if (this.onAfterMove) this.onAfterMove(item)
      }
      before = nodes[0]
    }
  }

  /** Re-attach and re-order a loop that was populated while detached from the document. */
  refresh() {
    this._fixItemList(true)
    return this
  }

  // -------------------------------------------------------------------------------------------
  // access
  // -------------------------------------------------------------------------------------------

  getValue() {
    return this.items.map((item, i) => {
      try {
        return item.getValue()
      } catch (error) {
        console.error('failed getValue', i, item.getValue, item)
        throw error
      }
    })
  }

  /** A copy of the data currently rendered. */
  getData() {
    return this.data.slice()
  }

  /** The absolute index of the visible position `i` (`startIndex + i`) — the index the host's list
   *  uses for the row the loop renders there, and the one `keyBy`/`onBuild`/`attr.i` report.
   *
   *  @param {number} i visible position
   *  @returns {number}
   */
  absIndex(i) {
    return this.startIndex + i
  }

  /** The **absolute** index of any item the loop knows — visible or parked — or `-1`.
   *
   *  `getItemIndex()` answers the relative question the mutation API asks ("which position in
   *  `allItems` is this?"), which is what `removeItem`/`setItem` need; this answers the host's
   *  question ("which row of my list is this node showing?"). For the visible items they differ by
   *  `startIndex`, a difference windowing makes load-bearing.
   *
   *  @param {any} item item instance, its node, or a function resolving to one of those
   *  @returns {number}
   */
  getAbsoluteIndex(item) {
    if (!item) return -1
    if (typeof item === 'function') item = item()
    const index = this.getItemIndex(item)
    if (index < 0 || index >= this.count) return -1
    const el = toDomNode(item)
    const node = el instanceof Array ? el[0] : el
    // `__loop2Index` is stamped on every node, so a fragment resolves through its first node too
    if (node && typeof node.__loop2Index === 'number') return node.__loop2Index
    if (typeof item.__loop2Index === 'number') return item.__loop2Index
    return this.startIndex + index
  }

  get length() {
    return this.items.length
  }

  /** Number of visible entries (same as `count`). */
  size() {
    return this.count
  }

  getItems() {
    return this.items
  }

  getItem(index) {
    return this.items[index]
  }

  /** Index of `item` in `allItems` (visible or parked), or -1. Accepts an item instance, a node,
   *  an index or a function resolving to one of those. */
  getItemIndex(item) {
    if (typeof item === 'number') return item
    if (!item) return -1
    if (typeof item === 'function') item = item()
    const found = this._idx.get(item)
    if (found !== undefined) return found
    const el = toDomNode(item)
    if (el && el !== item) {
      const viaEl = this._idx.get(el)
      if (viaEl !== undefined) return viaEl
    }
    // a node stamped by this (or another) loop before the index map knew it
    if (el && typeof el.loopIndex === 'number') return el.loopIndex
    if (typeof item.loopIndex === 'number') return item.loopIndex
    return -1
  }

  map(cb) {
    this.items.map(cb)
  }

  forEach(cb) {
    this.items.forEach(cb)
  }
}

/**
 * Default item builder — the same shape `@jsx6/jsx6`'s `LoopItem` produces, so a `Loop2` item is a
 * drop-in for an item template written for `Loop`:
 *
 * - a class `item` is constructed (`new item(attr, [])`) and owns its own lifecycle;
 * - otherwise a plain object is built with `$v`/`setValue`/`getValue` and `$s`/`setState`/`getState`
 *   and `el`, and `item({ $v, value: $v, $s, attr, loop, primitive }, [], comp)` renders it.
 *
 * @param {{ data: any, i: number, tpl: any, item: any, attr: any, primitive: boolean, loop: Loop2 }} opts
 * @returns {any} the item (a component instance or a plain item object)
 */
export const Loop2Item = ({ data, i, tpl, item, attr, primitive, loop }) => {
  /** @type {any} component or plain object with value/state accessors and the generated `el` */
  let comp
  if (item.prototype) {
    comp = new item(attr, [])
  } else {
    let $v = (attr.value = attr.$v = primitive ? signal(data) : $State(data))
    let $s = (attr.$s = $State({}))
    comp = {
      setValue: $v,
      getValue: $v,
      $v,
      setState: $s,
      getState: $s,
      $s,
    }
    let el = (comp.el = forInsert(
      domWithScope(comp, () => item({ $v, value: $v, $s, attr, loop, primitive }, [], comp)),
    ))
    el.getValue = el.setValue = $v
  }
  return comp
}
