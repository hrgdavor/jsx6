import { makeState } from './makeState.js'
import { domWithScope, insert } from './jsx2dom.js'
import { insertAttr, h } from './jsx2dom.js'
import { isObj } from './core.js'

/**
 * @class
 */
export class Jsx6 {
  isJsx6 = true
  el
  contentArea
  propKey
  groupKey
  parent
  tagName = 'DIV'
  cName = ''

  constructor(attr, children, parent) {
    attr ||= {}
    children ||= []

    // TODO make readonly using Object.defineProperty ... after making utility function for it
    // if(attr.if){
    //   const ifValue = attr.if
    //   delete attr.if
    //   attr.hidden = isFunc(ifValue) ? v=>!ifValue() : !ifValue
    // }
    this.attr = attr
    this.children = children
    this.parent = parent

    if (attr.tagName !== undefined) {
      this.tagName = attr.tagName
      delete attr.tagName
    }
    domWithScope(this, () => this.createEl())
  }

  /*  Lazy initialize state proxy object*/
  get $s() {
    if (!this._$s) {
      this._$s = makeState({})
    }
    return this._$s
  }

  set $s(state) {
    if (!this._$s) {
      this._$s = makeState(state)
    } else {
      this._$s(state)
    }
  }

  getValue() {
    return this.$v()
  }

  /*  Lazy initialize value proxy object*/
  get $v() {
    if (!this.__$v) {
      this.__$v = makeState({})
    }
    return this.__$v
  }

  setValue(v) {
    this.$v(v)
  }
  set $v(v) {
    if (!this.__$v) {
      this.__$v = makeState(v)
    } else {
      this.__$v(v)
    }
  }

  __init(parent, before) {
    if (this.__initialized) return
    this.initTemplate()
    this.insertChildren()
    insert(parent, this.el, before)
    this.init(this.$s)
    this.__initialized = true
  }

  setParent(parent) {
    if (parent === window) console.error('window as parent ', this)
    this.parent = parent
  }

  createEl() {
    if (!this.tagName) {
      this.el = [document.createTextNode('')]
    } else {
      this.el = h(this.tagName)
      if (this.cName) this.classList.add(this.cName)
    }
    this.insertAttr(this.attr)
    this.contentArea ||= this.el

    this.el.propKey = this.propKey
    this.el.groupKey = this.groupKey
  }

  insertAttr(attr) {
    // can not add attributes to text node
    if (this.tagName) insertAttr(attr, this.el, this.parent, this)
  }

  created() {}

  initTemplate() {
    const state = this.$s
    let def = domWithScope(this, () => this.tpl(h))
    if (def) {
      let parent = this.el
      let before = null
      if (this.el instanceof Array) {
        before = this.el[0]
        parent = before.parentNode
      }
      insert(parent, def, before)
      return def
    }
  }

  /**
   * @param h - jsx factory
   * @param state - state object
   * @param $ - state binding proxy
   * @param self - reference to this
   */
  tpl(h, state, $state, self) {}

  insertChildren() {
    if (this.children) insert(this.contentArea, this.children)
  }

  init() {}

  addEventListener(name, callback) {
    this.el.addEventListener(name, callback)
  }

  getAttribute(attr) {
    return this.el.getAttribute(attr)
  }
  setAttribute(attr, value) {
    return this.el.setAttribute(attr, value)
  }
  hasAttribute(attr) {
    return this.el.hasAttribute(attr)
  }
  removeAttribute(attr) {
    return this.el.removeAttribute(attr)
  }
  getBoundingClientRect() {
    return this.el.getBoundingClientRect()
  }
  appendChild(c) {
    insert(this.el, c)
  }
  insertBefore(c, before) {
    if (this.el instanceof Array) {
      const el = this.el[0]
      this.el.push(insert(el.parentNode, c, el))
    } else {
      insert(this.contentArea || this.el, c, before)
    }
  }

  get classList() {
    return this.el.classList
  }
  get style() {
    return this.el.style
  }
  get innerHTML() {
    return this.el.innerHTML
  }
  get textContent() {
    return this.el.textContent
  }
}

Jsx6.isComponentClass = true
