import { makeState } from './dirty.js'
import { domWithScope, insert } from './jsx2dom.js'
import { insertAttr, h } from './jsx2dom.js'
import { isObj } from './core.js'

/**
 * @typedef {Object} Jsx6Extras
 * @class
 * @mixin
 * @property {string} XXL - xxl prop
 *
 */

/**
 * @mixes Jsx6Extras
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
    // TODO make readonly using Object.defineProperty ... after making utility function for it
    this.$h = h.bind(this)
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
  }

  get state() {
    if (!this.__state) {
      this.__state = makeState({})
    }
    return this.__state
  }

  set state(state) {
    if (!this.__state) {
      this.__state = makeState(state)
    } else {
      this.__state(state)
    }
  }

  getValue() {
    return this.value().getValue()
  }
  get value() {
    if (!this.__value) {
      this.__value = makeState({})
    }
    return this.__value
  }

  setValue(value) {
    this.value = value
  }
  set value(value) {
    if (!this.__value) {
      this.__value = makeState(value)
    } else {
      this.__value(value)
    }
  }

  __init(parent, before) {
    if (this.__initialized) return
    this.createEl(this.$h)
    this.initTemplate()
    this.insertChildren()
    insert(parent, this.el, before)
    this.init(this.state)
    this.__initialized = true
  }

  setParent(parent) {
    if (parent === window) console.error('window as parent ', this)
    this.parent = parent
  }

  createEl(h) {
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
  destroy() {
    delete this.el.component
  }
  destroyed() {}

  initTemplate() {
    const state = this.state
    let def = domWithScope(this, () => this.tpl(h, state, state()(), this))
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
