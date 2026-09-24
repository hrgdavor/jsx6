import { setValue, domWithScope, forInsert, insert, toDomNode } from '@jsx6/jsx6'

import { $State, observeNow, signal } from '@jsx6/signal'
import { define } from './JsxW.js'

const _remove = item => {
  // Items are component objects carrying their node on `.el`, so the node has to be resolved —
  // without this the detach was a silent no-op and removed items stayed in the DOM.
  const el = toDomNode(item)
  el.parentNode?.removeChild(el)
}

/**
 * Options accepted by the Loop constructor. Any additional properties are passed to the
 * created items as attributes (`itemAttr`).
 *
 * @typedef {object} LoopOptions
 * @property {*} [p] property group binding handled by the jsx runtime (not used by Loop itself)
 * @property {*} [item] component or render function used to create a single loop item
 * @property {Function} [builder] creates a single loop item, defaults to LoopItem
 * @property {Function} [setter] sets the value of a loop item, defaults to setValue
 * @property {*} [tpl] template function used by the loop items
 * @property {*} [value] observable holding the array of items
 * @property {boolean} [primitive] is the value for each element a primitive, unlike when comonly it is an object with multiple keys
 * @property {boolean} [outside] insert the loop items outside of the loop element
 */

export class Loop extends HTMLElement {
  static {
    define('jsx6-loop', this)
  }

  items = []
  allItems = []
  count = 0
  /**
   * parent the items are inserted into (the loop element itself unless `outside` is used)
   * @type {ParentNode|null}
   */
  insertParent = null
  /**
   * marks the loop as connected, checked by getValue
   * @type {boolean}
   */
  connected = false
  /** value remembered by setValue, returned by getValue while the loop is not connected. @type {any} */
  lastValue

  /** @param {LoopOptions} [opts] */
  constructor({
    p,
    item,
    builder = LoopItem,
    setter = setValue,
    tpl,
    value,
    primitive,
    outside = false,
    ...itemAttr
  } = {}) {
    super()
    this.itemAttr = itemAttr
    this.isPrimitive = !!primitive
    this.builder = builder
    this.setter = setter
    this.item = item
    this.tplFunc = tpl
    this.outside = !!outside
    this.placeBefore = null
    if (outside) {
      this.setAttribute('outside', '')
      this.placeBefore = this
    } else {
      this.insertParent = this
    }
    observeNow(value, v => this.setValue(v))
  }

  connectedCallback() {
    this.connected = true
    this.insertParent = this.parentNode
    this.items.forEach(c => insert(this.parentNode, c, this))
  }

  disconnectedCallback() {
    this.connected = false
    // Was `delete this.insertParent`, which TypeScript 7 rejects (the property is not optional).
    // Assigning `null` keeps the same falsy state the `!this.insertParent` guard below relies on.
    this.insertParent = null
  }

  setValue(v = []) {
    // wait for connectedCallback, so
    // setvalue before parent is available will fail
    v = v || []
    // Remember the raw value: getValue() falls back to it while the loop is detached.
    this.lastValue = v
    v.forEach((d, i) => this.setItem(d, i))
    this.count = v.length
    this._fixItemList(true)
  }

  getValue() {
    if (!this.connected) return this.lastValue || []

    return this.items.map((item, i) => {
      try {
        return item.getValue()
      } catch (error) {
        console.error('failed getValue', i, item.getValue, item)
        throw error
      }
    })
  }

  setItem(newData, i) {
    var item = this.allItems[i]

    if (!item) item = this.allItems[i] = this.makeItem(newData, i)
    else this.setter(item, newData, i)

    if (item.el) item.el.loopIndex = i
    else item.loopIndex = i
  }

  insert(el, before) {
    if (this.outside && !this.insertParent) return

    insert(this.insertParent, el, before || this.placeBefore)
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
          el.parentNode.removeChild(el)
        }
      }
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

  getItemIndex(item) {
    if (typeof item === 'number') return item
    if (!item) return -1
    if (typeof item === 'function') {
      item = item()
    }
    return item.loopIndex
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
    _remove(item)

    this._fixItemList()

    return item
  }

  moveItem(fromIndex, placeBefore) {
    var item = this.allItems.splice(fromIndex, 1)[0]
    if (fromIndex < placeBefore) placeBefore--
    var elBefore = placeBefore < 0 ? null : toDomNode(this.allItems[placeBefore])
    if (placeBefore < 0) {
      this.allItems.push(item)
    } else {
      this.allItems.splice(placeBefore, 0, item)
    }
    this.insert(toDomNode(item), elBefore)
    this._fixItemList(true)
  }

  removeItem(item) {
    var index = this.getItemIndex(item)
    if (index === -1 || index === undefined) return
    this.splice(index, 1)
  }

  size() {
    return this.count
  }

  splice(index, deleteCount, ...toAdd) {
    // `toAdd` is a plain rest parameter rather than a hand-rolled slice of `arguments`: TypeScript 7
    // types `arguments` as `IArguments`, whose `splice.call(target, start, deleteCount)` signature
    // rejects the two-argument form this method is called with. Same values, same behaviour.

    // items not used and hidden for reuse later
    var countReusable = this.allItems.length - this.count

    for (var d = 0; d < toAdd.length; d++) {
      if (deleteCount <= 0) {
        // need to inject new item (reuse one from the end of allItems array, or create new)
        var newItem = countReusable > 0 ? this.allItems.pop() : this.makeItem(toAdd[d], index)
        this.allItems.splice(index, 0, newItem)
        var next = this.allItems[index + 1]
        this.insert(toDomNode(this.allItems[index]), next ? toDomNode(next) : null)
        countReusable--
      }
      this.setItem(toAdd[d], index)
      index++
      deleteCount--
    }

    if (deleteCount > 0) {
      var removed = this.allItems.splice(index, deleteCount)
      for (var i = 0; i < removed.length; i++) {
        var tmp = removed[i]
        // Detach only: the node stays in allItems for reuse. Inserting it first and removing it
        // again would be two wasted DOM mutations (same defect as jsx6's Loop, P0-4).
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
