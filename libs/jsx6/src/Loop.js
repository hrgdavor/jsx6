import { throwErr } from './core.js'
import { toDomNode } from './toDomNode.js'
import { JSX6E12_ITEM_NOT_FOUND } from './errorCodes.js'
import { domWithScope, factories, forInsert, h, insert } from './jsx2dom.js'

import { $State, observeNow, signal } from '@jsx6/signal'
import { setValue } from './setValue.js'

const _remove = item => {
  const el = toDomNode(item)
  el.parentNode?.removeChild(el)
}

export class Loop {
  items = []
  allItems = []
  count = 0

  constructor({ p, item, builder = LoopItem, setter = setValue, tpl, value, primitive, ...itemAttr } = {}) {
    this.itemAttr = itemAttr
    this.isPrimitive = !!primitive
    this.builder = builder
    this.setter = setter
    observeNow(value, v => this.setValue(v), true)
    this.item = item
    this.tplFunc = tpl

    this.el = factories.Text('')
  }

  setValue(v) {
    v = v || []

    v.forEach((d, i) => this.setItem(d, i))
    this.count = v.length
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

  setItem(newData, i) {
    var item = this.allItems[i]

    if (!item) item = this.allItems[i] = this.makeItem(newData, i)
    else this.setter(item, newData, i)

    if (item.el) item.el.loopIndex = i
    else item.loopIndex = i
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
    _remove(item)

    this._fixItemList()

    return item
  }

  moveItem(fromIndex, insertBefore) {
    var item = this.allItems.splice(fromIndex, 1)[0]
    if (fromIndex < insertBefore) insertBefore--
    var elBefore = insertBefore < 0 ? null : (elBefore = todomNode(this.allItems[insertBefore]))
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
        this.insert(toDomNode(tmp), this.itemNextSibling || null)
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
