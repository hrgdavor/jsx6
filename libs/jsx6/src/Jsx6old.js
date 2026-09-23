// @ts-nocheck
// Deprecated legacy component class, documented for removal in the project improvement plan.
// Kept only for backwards compatibility, so it is not worth type-annotating.
import { domWithScope, insert } from './jsx2dom.js'
import { insertAttr, h } from './jsx2dom.js'
import { addClass } from './addClass.js'

import { $State } from '@jsx6/signal'

/**
 * Legacy component class, kept for backwards compatibility only.
 *
 * `jsx6` has three component models: this one (`Jsx6old`, a `tagName` based class), the `Jsx6`
 * wrapper (which exposes the created node as `.el`) and `JsxW` from `@jsx6/w` (real custom
 * elements). `JsxW`/`@jsx6/w` is the canonical model - its `Loop` and lifecycle are the ones
 * that keep evolving - so new components must not be built on this class and bug fixes must not
 * be duplicated here.
 *
 * @deprecated Legacy component model. Use `JsxW` from `@jsx6/w` instead; this class is a
 *   removal candidate for the next major release (see `plan/improvement-plan.md`, work item
 *   P3-2).
 * @class
 */
export class Jsx6old {
  isJsx6 = true
  /** @type {HTMLElement} */
  el
  contentArea
  propKey
  groupKey
  tagName = 'DIV'
  cName = ''

  constructor(attr = {}, children = []) {
    this.attr = this.initAttr(attr)
    this.children = children

    if (attr.tagName !== undefined) {
      this.tagName = attr.tagName
      delete attr.tagName
    }
    domWithScope(this, () => this.createEl())
    if (!attr.lazyload) this.__init()
  }

  initAttr(attr) {
    return attr
  }
  /*  Lazy initialize state proxy object*/
  get $s() {
    if (!this._$s) {
      this._$s = $State({})
    }
    return this._$s
  }

  set $s(state) {
    if (!this._$s) {
      this._$s = $State(state)
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
      this.__$v = $State({})
    }
    return this.__$v
  }

  setValue(v) {
    this.$v(v)
  }
  set $v(v) {
    if (!this.__$v) {
      this.__$v = $State(v)
    } else {
      this.__$v(v)
    }
  }

  __init() {
    if (this.__initialized) return
    this.initTemplate()
    this.insertChildren()
    this.init(this.$s)
    this.__initialized = true
  }

  setParent(parent) {
    if (parent === window) console.error('window as parent ', this)
    this.parent = parent
  }

  createEl() {
    if (!this.tagName) {
      this.el = document.createTextNode('')
    } else {
      this.el = h(this.tagName)
      if (this.cName) addClass(this.el, this.cName)
    }
    this.insertAttr(this.attr)
    this.contentArea ||= this.el

    this.el.propKey = this.propKey
    this.el.groupKey = this.groupKey
  }

  insertAttr(attr) {
    // can not add attributes to text node
    if (this.el.tagName) insertAttr(attr, this.el, this, this, true)
  }

  created() {}

  initTemplate() {
    // Touch the lazy `$s` getter so the state proxy exists before the template runs (the local
    // binding itself was unused).
    void this.$s
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

Jsx6old.isComponentClass = true
