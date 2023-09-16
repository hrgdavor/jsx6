import { domWithScope, insert } from '@jsx6/jsx6'
import { $State } from '@jsx6/signal-state'

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
      this._$s = $State({})
    }
    return this._$s
  }
  /*  Lazy initialize value proxy object*/
  get $v() {
    if (!this.__$v) {
      this.__$v = $State({})
    }
    return this.__$v
  }
  getValue() {
    return this.$v()
  }
  setValue(v) {
    this.$v(v)
  }
  mergeValue(v) {
    mergeValue(this.$v, v)
  }
  setParent(parent) {
    if (parent === window) console.error('window as parent ', this)
    this.parent = parent
  }
  /**
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
