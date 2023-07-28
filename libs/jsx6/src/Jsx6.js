import { makeState, domWithScope, insert } from '@jsx6/jsx6'

export class Jsx6 {
  isJsx6 = true
  propKey
  groupKey
  constructor(...args) {
    /** @type {HTMLElement} */
    this.el = domWithScope(this, () => this.tpl(...args))
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
  setParent(parent) {
    if (parent === window) console.error('window as parent ', this)
    this.parent = parent
  }
  /**
   * @param h - jsx factory
   * @param state - state object
   * @param $ - state binding proxy
   * @param self - reference to this
   */
  tpl(attr = {}) {
    return <div {...attr} />
  }
  addEventListener(...args) {
    this.el.addEventListener(...args)
  }
  getAttribute(attr) {
    return this.el.getAttribute(attr)
  }
  setAttribute(attr, value) {
    return this.el.setAttribute(attr, value)
  }
  hasAttribute(attr) {
    return this.el?.hasAttribute?.(attr)
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
