import { domWithScope, insert, h } from './jsx2dom.js'
import { $State, mergeValue } from '@jsx6/signal'
import { addDisposer } from './dispose.js'

/** Call the optional `ondestroy()` hook of a component.
 *
 * `ondestroy` is deliberately NOT declared as a class field on `Jsx6`: a field initializer
 * (`ondestroy`) would create an own `undefined` property on every instance and shadow an
 * `ondestroy()` method defined on a subclass prototype. Subclasses simply implement
 * `ondestroy() {}`, and it may also be assigned on an instance after construction.
 *
 * @param {any} comp
 */
const callOndestroy = comp => {
  if (typeof comp.ondestroy === 'function') comp.ondestroy()
}

export class Jsx6 {
  isJsx6 = true
  propKey
  groupKey
  constructor(...args) {
    /** @type {HTMLElement} */
    this.el = domWithScope(this, () => this.tpl(...args))
    // P2-1 stage 3: `ondestroy()` is invoked by disposeNode() (and therefore by remove()/replace())
    // after the component's own DOM bindings and its descendants have been released.
    addDisposer(this.el, () => callOndestroy(this))
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
    return h('div', attr)
  }
  /** Mirror of DOM addEventListener, delegated to the component's root element.
   *
   * @param {Parameters<HTMLElement['addEventListener']>} args
   */
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
