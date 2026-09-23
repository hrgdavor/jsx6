import { throwErr } from './core.js'
import { toDomNode } from './toDomNode.js'
import { JSX6E12_ITEM_NOT_FOUND } from './errorCodes.js'
import { domWithScope, factories, forInsert, insert } from './jsx2dom.js'

import { $State, observeNow, signal } from '@jsx6/signal'
import { setValue } from './setValue.js'
import { addDisposer, disposeNode } from './dispose.js'

const _remove = item => {
  const el = toDomNode(item)
  el.parentNode?.removeChild(el)
}

// ---------------------------------------------------------------------------------------------
// Keyed reconciliation helpers (P2-2).
//
// `key` is the only key mechanism: `insertAttr` (jsx2dom.js) already writes a JSX `key` attribute
// to `node.loopKey` (always) and `node.$key` (when free) — on the element and, for components that
// pass themselves to `insertAttr`, on the component. Loop reads those same properties, and never
// introduces a second kind of key. See plan/keyed-loop-design.md for the full contract.
// ---------------------------------------------------------------------------------------------

/** Can `value` be used as a `WeakMap` key? (only objects and functions can be) */
const isWeakKey = value => value !== null && (typeof value === 'object' || typeof value === 'function')

/** Resolve a stored key to the value the user wrote.
 *
 *  `insertAttr` stores the *attribute value* of the JSX `key`, and in jsx6 a data-driven key
 *  (`key={value.id}`) is a signal — a function. Reading the key therefore means calling it, which
 *  is exactly what `insertAttr`'s own updater does (`setAttribute(node, 'key', func())`).
 *
 *  @param {any} key
 *  @returns {any}
 */
const keyValue = key => (typeof key === 'function' ? key() : key)

/** Key declared by a *datum* through the same `$key` / `loopKey` properties `insertAttr` writes,
 *  or by the root element of a datum that is itself a built item/component (anything with `.el`).
 *
 *  `undefined` means "unkeyed": the datum keeps the index-based reuse. Primitive data can never
 *  carry a key, so a primitive loop stays index-reconciled by design.
 *
 *  @param {any} data
 *  @returns {any} the key, or undefined
 */
const dataKey = data => {
  if (!isWeakKey(data)) return undefined
  let key = keyValue(data.loopKey ?? data.$key)
  if (key !== undefined && key !== null) return key
  const el = data.el
  // a datum that is a Loop item built elsewhere (e.g. `loopB.setValue(loopA.getItems())`)
  if (el && !(el instanceof Array) && el.nodeType) key = keyValue(el.loopKey)
  return key ?? undefined
}

/** Key a *built item* declared for the data it was constructed with: its own `$key`/`loopKey`
 *  (class components set by `insertAttr`), or the `loopKey` of its root element (the plain-object
 *  item shape, where the item template wrote `key={...}`).
 *
 *  Must only be read right after `makeItem()`: `insertAttr` evaluates the JSX `key` once, at build
 *  time, so the value is frozen and belongs to the datum the item was built with.
 *
 *  `el.$key` is deliberately NOT consulted here: on an element `$key` is also the `p` attribute
 *  group name (`setPropGroup`), so it is ambiguous; `loopKey` is written only by a JSX `key`.
 *
 *  @param {any} item
 *  @returns {any} the key, or undefined
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

/** The DOM nodes one item contributes (an item template may render a fragment/array of nodes).
 *
 *  @param {any} item
 *  @returns {any[]}
 */
const nodesOf = item => {
  const el = toDomNode(item)
  if (!el) return []
  if (el instanceof Array) return el.filter(n => n && n.nodeType)
  return el.nodeType ? [el] : []
}

/** Options accepted by the Loop constructor.
 *
 * @typedef LoopOptions
 * @prop {any} [p] property path where the loop element is assigned on the parent scope
 * @prop {any} [item] component or function used to create a single loop item
 * @prop {Function} [builder] creates a single loop item, defaults to LoopItem
 * @prop {Function} [setter] sets the value of a loop item, defaults to setValue
 * @prop {any} [tpl] template function used by the loop items
 * @prop {any} [value] observable value holding the array of items
 * @prop {boolean} [primitive] true when loop values are primitive values
 *
 * Keyed reconciliation (P2-2) reads the key of each datum from its `$key` / `loopKey` property —
 * the same properties `insertAttr` stores for a JSX `key` — and falls back to index-based reuse for
 * data without a key. An item's own JSX `key` is read from the item right after it is built (see
 * `_learnKey`). `Loop#getItemByKey(key)` exposes the key → item map; see plan/keyed-loop-design.md.
 */

export class Loop {
  items = []
  allItems = []
  count = 0

  /** key → item: the keyed-reconciliation index (P2-2). A keyed item stays in this map while it is
   *  parked in the reuse pool, so removing and re-adding the same key reuses the same instance.
   *  @type {Map<any, any>} */
  keyMap = new Map()
  /** item → the key it owns (reverse of `keyMap`); a `WeakMap` so a dropped item stays collectable.
   *  @type {WeakMap<any, any>} */
  _itemKeys = new WeakMap()
  /** datum → the key the item built for it declared in its own template. The JSX `key` is
   *  evaluated once, at build time, so this is what makes a template key (`key={value.id}`)
   *  matchable on a later update of the same datum object.
   *  @type {WeakMap<any, any>} */
  _dataKeys = new WeakMap()

  /** @param {LoopOptions} [opts] */
  constructor({ p, item, builder = LoopItem, setter = setValue, tpl, value, primitive, ...itemAttr } = {}) {
    this.itemAttr = itemAttr
    this.isPrimitive = !!primitive
    this.builder = builder
    this.setter = setter
    this.item = item
    this.tplFunc = tpl
    this.el = factories.Text('')
    if (value) {
      // if declared inside template and has elements, we can not add them observeNow
      // setTimeout makes sure it will execute after current task, and parent will be created
      setTimeout(() => this._observeValue(value), 0)
      //TODO check use Promise.resolve().then(
    }
    // The anchor text node is what actually gets inserted in the document (forInsert unwraps
    // `.el`), so it owns the loop's teardown: disposing it tears the whole loop down (P2-1).
    addDisposer(this.el, () => this.dispose())
  }

  /** Observe the loop's value array. Split out of the constructor so the unsubscribe function
   *  can be kept (dispose() calls it, and disposes the loop if the timer fires too late).
   *
   * @param {any} value observable holding the array of items
   */
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

  /** Permanently release this loop: the value subscription and the bindings of every item,
   *  including the hidden items kept in `allItems` for reuse.
   *
   * Called automatically when the loop's anchor node is disposed, which happens for
   * `remove()` / `replace()` of any ancestor of the loop. Idempotent, and, like the rest of
   * `disposeNode()`, it does not detach nodes from the DOM. After disposal the loop is empty;
   * a later manual `setValue()` would build fresh items, but the watched signal is no longer
   * observed (see plan/disposal-design.md).
   *
   * @returns {this}
   */
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
    for (const item of items) disposeNode(toDomNode(item))

    // the key index dies with the items
    this.keyMap.clear()
    this._itemKeys = new WeakMap()
    this._dataKeys = new WeakMap()

    // also clear whatever else was registered on the anchor
    disposeNode(this.el)
    return this
  }

  /** Permanently remove one item: release its bindings, drop it from `allItems` so it can never
   *  be reused, and detach its node.
   *
   * This is the only item-eviction path that disposes. `setValue()`, `pop()` and `splice()` only
   * detach items past `count` and keep them in `allItems` for reuse (see `_fixItemList` and the
   * "Loop reuse caveat" in plan/disposal-design.md), so their bindings must stay alive.
   *
   * @param {any} item item instance or its index
   * @returns {any} the disposed item, or undefined when it is not part of the loop
   */
  disposeItem(item) {
    const index = this.getItemIndex(item)
    if (index === -1 || index === undefined || index < 0 || index >= this.allItems.length) return undefined

    const [removed] = this.allItems.splice(index, 1)
    const el = toDomNode(removed)
    disposeNode(el)
    if (el?.parentNode) el.parentNode.removeChild(el)
    // a disposed item releases its key as well, so the key can be re-created fresh later
    this._setItemKey(removed, undefined)
    if (index < this.count) this.count--
    this._fixItemList(true)
    return removed
  }

  /** Reconcile the loop with a new array of data (P2-2).
   *
   * Items are matched **by key first**, then by their previous index, so data without a key keeps
   * the previous index-based behaviour exactly. Matched items are *moved*, never rebuilt: the item
   * instance, its state and its bindings survive a reorder. Items that are no longer visible are
   * parked in `allItems` for reuse and are never disposed here — `disposeItem()` / `dispose()`
   * are the only paths that release bindings (see plan/disposal-design.md).
   *
   * @param {any[]} v
   */
  setValue(v) {
    v = v || []
    const n = v.length
    const all = this.allItems
    /** item that will be displayed at each visible position @type {any[]} */
    const next = Array.from({ length: n })
    /** key wanted by each datum: explicit `$key`/`loopKey`, or the key learned when it was built */
    const wanted = Array.from({ length: n })
    const used = new Set()
    const created = new Set()

    for (let i = 0; i < n; i++) wanted[i] = this._wantedKey(v[i])

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

    // pass 2 — index fallback: unkeyed data keeps today's positional reuse
    for (let i = 0; i < n; i++) {
      if (next[i]) continue
      const item = all[i]
      if (item && !used.has(item)) {
        next[i] = item
        used.add(item)
      }
    }

    // pass 3 — reuse a parked item, or build a new one for the remaining positions
    const free = all.filter(item => !used.has(item))
    for (let i = 0; i < n; i++) {
      if (next[i]) continue
      const parked = free.shift()
      if (parked) {
        next[i] = parked
        continue
      }
      const built = this.makeItem(v[i], i)
      next[i] = built
      created.add(built)
      // `makeItem()` records the key the item's own template declared for this datum
      if (wanted[i] === undefined) wanted[i] = this._itemKeys.get(built)
    }

    // `next` is the new visible order; the leftovers stay parked for reuse in their old order
    this.allItems = next.concat(free)
    this.count = n

    const claimedKeys = new Set()
    for (let i = 0; i < n; i++) {
      const item = next[i]
      // an item re-used by index keeps the key it was built/claimed with (its element key is frozen
      // anyway); a datum with a key always wins
      let key = wanted[i] === undefined ? this._itemKeys.get(item) : wanted[i]
      if (key !== undefined) {
        if (claimedKeys.has(key)) key = undefined // duplicate key: the first occurrence owns it
        else claimedKeys.add(key)
      }
      if (!created.has(item)) this.setter(item, v[i], i)
      if (key !== undefined) this._setItemKey(item, key)
    }

    this._fixItemList(true)
  }

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

  /** Update or create the item that displays `newData` at position `i`.
   *
   * Keyed data first claims the item that owns its key *when that item is parked in the reuse
   * pool* (an entry that was removed earlier): the instance is moved into slot `i`, never rebuilt,
   * so its state survives. A key owned by a *visible* item is left alone — reordering visible
   * items is `setValue()`'s job, and a duplicate key must not silently rearrange the list.
   *
   * @param {any} newData
   * @param {number} i
   * @returns {any} the item now at position `i`
   */
  setItem(newData, i) {
    const claimed = this._claimParked(newData, i, false)
    let item = claimed || this.allItems[i]

    if (item) this.setter(item, newData, i)
    else item = this.allItems[i] = this.makeItem(newData, i)

    this._claimKey(item, this._wantedKey(newData))
    if (item.el) item.el.loopIndex = i
    else item.loopIndex = i
    return item
  }

  /** Key that drives matching for one datum: an explicit `$key`/`loopKey`, or the key remembered
   *  when the item for this datum was built. `undefined` = unkeyed (index-based reuse).
   *
   *  @param {any} data
   *  @returns {any}
   */
  _wantedKey(data) {
    const key = dataKey(data)
    return key === undefined ? this._dataKeys.get(data) : key
  }

  /** The item parked in the reuse pool that owns `newData`'s key, moved into slot `i`.
   *
   *  @param {any} newData
   *  @param {number} i target slot
   *  @param {boolean} grow true when the datum adds a new entry (the list grows: slot `i` shifts
   *    right), false when it replaces the entry at slot `i` (positions stay stable, so the item
   *    that was there is parked in the claimed item's old slot instead)
   *  @returns {any} the claimed item, or undefined when the datum is unkeyed or its key belongs to
   *    a visible item
   */
  _claimParked(newData, i, grow) {
    const key = this._wantedKey(newData)
    if (key === undefined) return undefined
    const matched = this.keyMap.get(key)
    if (!matched) return undefined
    const all = this.allItems
    const from = all.indexOf(matched)
    // only a parked item may be claimed here; a visible owner keeps its key and its position
    if (from === -1 || from < this.count) return undefined
    if (from === i) return matched
    if (grow) {
      all.splice(from, 1)
      all.splice(i, 0, matched)
      return matched
    }
    if (i >= all.length) return undefined
    // swap: the claimed item takes slot `i`, and the item that was there goes to the parked slot
    all[from] = all[i]
    all[i] = matched
    return matched
  }

  /** Make `item` the owner of `key`, or drop its key when `key` is undefined. */
  _setItemKey(item, key) {
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
   *  steals the item of an earlier entry. Used by `setItem`/`splice`, which add one entry at a
   *  time; `setValue` does its own first-occurrence-wins bookkeeping. */
  _claimKey(item, key) {
    if (!item || key === undefined || key === null) return
    const owner = this.keyMap.get(key)
    if (owner === item) return
    if (owner) {
      const at = this.allItems.indexOf(owner)
      if (at !== -1 && at < this.count) return
      this._setItemKey(owner, undefined)
    }
    this._setItemKey(item, key)
  }

  /** Read the key a freshly built item declared for `data` (its own `$key`/`loopKey`, or the
   *  `loopKey` of its root element) and remember it for that datum object.
   *
   *  Only meaningful right after a build: `insertAttr` evaluates a JSX `key` once, so re-reading it
   *  later would register a key that belongs to an older datum.
   *
   *  @param {any} item
   *  @param {any} data
   *  @returns {any} the key, or undefined when the item is unkeyed
   */
  _learnKey(item, data) {
    const key = dataKey(data) ?? itemKey(item)
    if (key === undefined || key === null) return undefined
    if (isWeakKey(data)) this._dataKeys.set(data, key)
    this._setItemKey(item, key)
    return key
  }

  insert(el, before) {
    insert(this.el.parentNode, el, before || this.el)
  }

  makeItem(data, i) {
    const { builder, setter } = this
    const comp = builder({
      data,
      i,
      loop: this,
      tpl: this.tplFunc,
      item: this.item,
      primitive: this.isPrimitive,
      attr: { ...this.itemAttr },
    })
    setter(comp, data, i)
    this.insert(comp)
    // the item's own template may declare the key (`key={value.id}`) — record it for this datum
    this._learnKey(comp, data)
    return comp
  }

  _fixItemList(reindex) {
    const count = this.count
    this.items = this.allItems.slice(0, count)
    if (reindex) {
      var it = this.allItems
      for (var i = 0; i < it.length; i++) {
        const el = toDomNode(it[i])
        el.loopIndex = i
        if (i < count && !el.parentNode) {
          this.insert(el)
        } else if (i >= count && el.parentNode) {
          // Detach only, never dispose: this item stays in `allItems` and can be re-inserted
          // (and re-used) by a later setValue/splice. See plan/disposal-design.md.
          el.parentNode.removeChild(el)
        }
      }
      // keyed reconciliation moves items between positions, so the DOM order has to be re-checked
      this._orderDom()
    }
  }

  /** Put the visible item nodes in `items` order. `_fixItemList()` has already attached every
   *  visible item and detached the parked ones, so this only has to fix the order.
   *
   *  Walks backwards, anchoring each item directly before the next one (the last one before the
   *  loop's anchor text node), and touches the DOM only when an item is not already in place — an
   *  unchanged list performs no DOM mutation at all. An item whose template rendered a fragment
   *  (an array of nodes) is moved as a group.
   */
  _orderDom() {
    const parent = this.el.parentNode
    if (!parent) return
    const items = this.items
    let before = this.el
    for (let i = items.length - 1; i >= 0; i--) {
      const nodes = nodesOf(items[i])
      if (!nodes.length) continue
      const last = nodes[nodes.length - 1]
      if (last.parentNode !== parent || last.nextSibling !== before) {
        for (const node of nodes) parent.insertBefore(node, before)
      }
      before = nodes[0]
    }
  }

  get length() {
    return this.items.length
  }

  map(cb) {
    this.items.map(cb)
  }

  forEach(cb) {
    this.items.forEach(cb)
  }

  getItems() {
    return this.items
  }

  getItem(index) {
    return this.items[index]
  }

  /** The item registered under `key` — visible, or parked in the reuse pool — or `undefined`.
   *
   *  @param {any} key
   *  @returns {any}
   */
  getItemByKey(key) {
    return this.keyMap.get(key)
  }

  getItemIndex(item) {
    if (typeof item === 'number') return item
    if (!item) return -1
    if (typeof item === 'function') {
      // TODO better way to recognize item
      item = item()
    }
    return item.el ? item.el.loopIndex : item.loopIndex
  }

  push(data) {
    var index = this.count
    this.setItem(data, index)
    this.count++
    this._fixItemList(true)
    return this.getItem(index)
  }

  pop(data) {
    if (this.count == 0) return
    this.count--
    var item = this.items.pop()
    // Detach only: the item stays in `allItems` (index `count`) and is reused on the next insert,
    // so it must not be disposed. Use `disposeItem()` to drop it for good.
    _remove(item)

    this._fixItemList()

    return item
  }

  moveItem(fromIndex, insertBefore) {
    var item = this.allItems.splice(fromIndex, 1)[0]
    if (fromIndex < insertBefore) insertBefore--
    var elBefore = insertBefore < 0 ? null : toDomNode(this.allItems[insertBefore])
    if (insertBefore < 0) {
      this.allItems.push(item)
    } else {
      this.allItems.splice(insertBefore, 0, item)
    }
    this.insert(toDomNode(item), elBefore)
    this._fixItemList(true)
  }

  removeItem(item) {
    var index = this.getItemIndex(item)
    if (index === -1 || index === undefined) throwErr(JSX6E12_ITEM_NOT_FOUND, item)
    this.splice(index, 1)
  }

  size() {
    return this.count
  }

  splice(index, deleteCount) {
    var toAdd = Array.prototype.splice.call(arguments, 2)

    // items not used and hidden for reuse later
    var countReusable = this.allItems.length - this.count

    for (var d = 0; d < toAdd.length; d++) {
      if (deleteCount <= 0) {
        // need to inject new item: a parked item that owns the datum's key is claimed back first
        // (its state survives the remove/re-add round trip), otherwise reuse one from the end of
        // allItems, or create a new one
        var claimed = this._claimParked(toAdd[d], index, true)
        var newItem = claimed
        var created = false
        if (!newItem) {
          if (countReusable > 0) {
            newItem = this.allItems.pop()
          } else {
            newItem = this.makeItem(toAdd[d], index)
            created = true
          }
          this.allItems.splice(index, 0, newItem)
        }
        var next = this.allItems[index + 1]
        this.insert(toDomNode(newItem), next ? toDomNode(next) : null)
        // `makeItem()` already set the value; a claimed or popped item still holds its old data
        if (!created) this.setter(newItem, toAdd[d], index)
        this._claimKey(newItem, this._wantedKey(toAdd[d]))
        if (newItem.el) newItem.el.loopIndex = index
        else newItem.loopIndex = index
        countReusable--
      } else {
        // Delete and insert overlap: the item at `index` is on its way out, so it may be updated
        this.setItem(toAdd[d], index)
      }
      index++
      deleteCount--
    }

    if (deleteCount > 0) {
      var removed = this.allItems.splice(index, deleteCount)
      for (var i = 0; i < removed.length; i++) {
        var tmp = removed[i]
        // Detach only. The node stays in allItems so it can be reused by a later insert;
        // any insert here would be undone immediately by _remove (two wasted DOM mutations),
        // and it would also require the loop to already be attached to a parent.
        // Dispose is deliberately NOT called here for the same reuse reason — use
        // `disposeItem()` for a permanent removal.
        this.allItems.push(tmp)
        _remove(tmp)
      }
    }
    this.count = Math.max(this.count - deleteCount, 0)
    this._fixItemList(true)
  }
}

export const LoopItem = ({ data, i, tpl, item, attr, primitive, loop }) => {
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
