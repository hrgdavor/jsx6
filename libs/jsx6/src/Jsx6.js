import { makeState } from './dirty.js'
import { insert } from './insert.js'
import { insertHtml, insertAttr, h } from './insertHtml.js'
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
  state = {}

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

  __init(parent, before) {
    if (this.__initialized) return
    this.createEl()
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

  createEl() {
    this.initState()
    if (!this.tagName) {
      this.el = [document.createTextNode('')]
    } else {
      this.el = insertHtml(null, null, { tag: this.tagName }, this)
      if (this.cName) this.classList.add(this.cName)
    }
    this.insertAttr(this.attr)
    this.contentArea ||= this.el

    this.el.propKey = this.propKey
    this.el.groupKey = this.groupKey
  }

  insertAttr(attr) {
    insertAttr(attr, this.el, this.parent, this)
  }

  initState() {
    if (this.state) {
      this.state = makeState(this.state)
    }
  }

  created() {}
  destroy() {
    delete this.el.component
  }
  destroyed() {}

  initTemplate() {
    let def = this.tpl(this.$h, this.state, this.state()(), this)
    if (def) {
      let parent = this.el
      let before = null
      if (this.el instanceof Array) {
        before = this.el[0]
        parent = before.parentNode
      }
      insertHtml(parent, before, def, this)
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
    insertHtml(this.contentArea, null, this.children, this)
  }

  init() {}

  get value() {
    return this.getValue()
  }
  getValue() {
    return this.jsx6SingleValue ? this.state.value() : this.state().getValue()
  }

  set value(value) {
    this.setValue(value)
  }
  setValue(value) {
    if (value === null || value === undefined) value = {}
    if (value && isObj(value)) {
      this.jsx6SingleValue = false
      this.state().replace(value)
    } else {
      this.jsx6SingleValue = true
      this.state().replace({ value })
    }
  }

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
