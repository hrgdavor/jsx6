import { throwErr } from './core.js'
import { makeState } from './dirty.js'
import { ERR_ITEM_NOT_FOUND } from './errorCodes.js'
import { domWithScope } from './jsx2dom.js'
import { Jsx6 } from './Jsx6.js'
import { setVisible } from './setVisible.js'

export class Loop extends Jsx6 {
  items = []
  allItems = []
  count = 0

  constructor(attr, children) {
    let itemAttr = attr
    attr = { tagName: attr.loopTag || '', p: attr.p }
    delete itemAttr.p
    delete itemAttr.loopTag

    super(attr, children)

    this.itemAttr = itemAttr

    if (itemAttr.item) {
      this.item = itemAttr.item
      delete itemAttr.item
    } else if (itemAttr.tpl) {
      this.tplFunc = itemAttr.tpl
      delete itemAttr.tpl
    }
  }

  setValue(v) {
    v = v || []

    v.forEach((d, i) => this.setItem(d, i))
    this.count = v.length
    this._fixItemList(true)
  }

  getValue() {
    return this.items.map(i => i.getValue())
  }

  setItem(newData, i) {
    var item = this.allItems[i]

    if (!item) item = this.allItems[i] = this.makeItem(newData, i)
    else item.setValue(newData)

    item.el.loopIndex = i
    if (newData !== undefined) {
      setVisible(item, true)
    }
  }

  makeItem(newData, i) {
    let comp

    const item = this.item
    const attr = { ...this.itemAttr }
    if (item.prototype) {
      comp = new this.item(attr, [], this.parent)
      this.insertBefore(comp)
    } else {
      attr.value = attr.$v = makeState(newData)
      const valueProxy = attr.$v()
      comp = {
        setValue: v => valueProxy.set(v),
        getValue: () => valueProxy.getValue(),
      }
      comp.el = domWithScope(comp, () => item(attr, [], comp, this.parent))
      valueProxy.el = comp.el
      this.insertBefore(comp)
    }
    comp.el.loopComp = this
    comp.setValue(newData)
    return comp
  }

  _fixItemList(reindex) {
    this.items = this.allItems.slice(0, this.count)
    if (reindex) {
      var it = this.allItems
      for (var i = 0; i < it.length; i++) {
        it[i].el.loopIndex = i
        setVisible(it[i], i < this.count)
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
      console.log('function', item, item().el)
      item = item()
    }
    return item.el ? item.el.loopIndex : item.loopIndex
  }

  push(data) {
    var index = this.count
    this.setItem(data, index)
    this.count++
    this._fixItemList()
    return this.getItem(index)
  }

  pop(data) {
    if (this.count == 0) return
    this.count--
    var item = this.items.pop()
    item.setVisible(false)

    this._fixItemList()

    this.fireEvent({ name: 'afterPop', item: item })
    return item
  }

  moveItem(fromIndex, insertBefore) {
    var item = this.allItems.splice(fromIndex, 1)[0]
    if (fromIndex < insertBefore) insertBefore--
    var elBefore = insertBefore < 0 ? null : (elBefore = this.allItems[insertBefore].el)
    if (insertBefore < 0) {
      this.allItems.push(item)
    } else {
      this.allItems.splice(insertBefore, 0, item)
    }
    this.insertBefore(item.el, elBefore)
    this._fixItemList(true)
  }

  removeItem(item) {
    var index = this.getItemIndex(item)
    if (index === -1 || index === undefined) throwErr(ERR_ITEM_NOT_FOUND, item)
    this.splice(index, 1)
  }

  size() {
    return this.count
  }

  splice(index, deleteCount) {
    console.log('splice', index, deleteCount)
    var toAdd = Array.prototype.splice.call(arguments, 2)

    // items not used and hidden for reuse later
    var countReusable = this.allItems.length - this.count

    for (var d = 0; d < toAdd.length; d++) {
      if (deleteCount <= 0) {
        // need to inject new item (reuse one from the end of allItems array, or create new)
        var newItem = countReusable > 0 ? this.allItems.pop() : this.makeItem(toAdd[d], index)
        this.allItems.splice(index, 0, newItem)
        var next = this.allItems[index + 1]
        this.insertBefore(this.allItems[index].el, next ? next.el : null)
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
        this.insertBefore(tmp.el, this.itemNextSibling || null)
        this.allItems.push(tmp)
        setVisible(tmp, false)
      }
    }
    this.count = Math.max(this.count - deleteCount, 0)
    this._fixItemList(true)
  }
}
