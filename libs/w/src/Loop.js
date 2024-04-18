import { setValue, domWithScope, forInsert, h, insert } from '@jsx6/jsx6'

import { $State, observeNow, signal } from '@jsx6/signal'
import { define } from './JsxW.js'

const _remove = el => {
  el.parentNode?.removeChild(el)
}

/**
 * @typedef Loop_
 * @param {boolean} primitive is the value for each element a primitive, unlike when comonly it is an object with multiple keys
 */

export class Loop extends HTMLElement {
  static {
    define('jsx6-loop', this)
  }

  items = []
  allItems = []
  count = 0

  constructor({
    p,
    item,
    builder = LoopItem,
    setter = setValue,
    tpl,
    value,
    /** @type {boolean} is the value for each element a primitive, unlike when comonly it is an object with multiple keys */
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
    observeNow(value, v => this.setValue(v), true)
  }

  connectedCallback() {
    this.insertParent = this.parentNode
    this.items.forEach(c => insert(this.parentNode, c, this))
  }

  disconnectedCallback() {
    delete this.insertParent
  }

  setValue(v = []) {
    // wait for connectedCallback, so
    // setvalue before parent is available will fail
    v = v || []
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
        const el = it[i]
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
    var elBefore = placeBefore < 0 ? null : (elBefore = this.allItems[placeBefore])
    if (placeBefore < 0) {
      this.allItems.push(item)
    } else {
      this.allItems.splice(placeBefore, 0, item)
    }
    this.insert(item, elBefore)
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

  splice(index, deleteCount) {
    var toAdd = Array.prototype.splice.call(arguments, 2)

    // items not used and hidden for reuse later
    var countReusable = this.allItems.length - this.count

    for (var d = 0; d < toAdd.length; d++) {
      if (deleteCount <= 0) {
        // need to inject new item (reuse one from the end of allItems array, or create new)
        var newItem = countReusable > 0 ? this.allItems.pop() : this.makeItem(toAdd[d], index)
        this.allItems.splice(index, 0, newItem)
        var next = this.allItems[index + 1]
        this.insert(this.allItems[index], next ? next : null)
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
        this.insert(tmp)
        this.allItems.push(tmp)
        _remove(tmp)
      }
    }
    this.count = Math.max(this.count - deleteCount, 0)
    this._fixItemList(true)
  }
}

export const LoopItem = ({ data, i, tpl, item, attr, primitive, loop }) => {
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
