import { setValue, getValue, domWithScope, insert, insertAttr } from '@jsx6/jsx6'
import { mergeValue, $State } from '@jsx6/signal'

/**
 * Template for a web component. If creating with shadowRoot mode:'open' is forced.
 * 
 * You can register the component automatically by using define utility. 
 * Just add a static block inside your class:
  ```js
  import { JsxW, define } from '@jsx6/w'
  class MyCustomElement extends JsxW {
    static { define('my-custom-element', this) } 
  }
 ```
 this will automatically register it first time created using jsx.
 If you want to give users control over registration, or it could be used in HTML without JSX
  ```js
  import { JsxW, define } from '@jsx6/w'
  class MyCustomElement extends JsxW {
    static define(tag='my-custom-element'){ define(tag, this) } 
  }
  // in that case user must call define before using it
  MyCustomElement.define()
 ```
 
 */
export class JsxW extends HTMLElement {
  static {
    define('jsx6-wc', this)
  }

  /**
   * Optional form-like object (see `linkForm`). Consumer code can assign it; when present,
   * getValue/setValue read and write that object instead of the internal `$v` proxy.
   * This class never assigns it itself.
   * @type {any}
   */
  form
  /** @type {any} */
  __pending

  constructor(attr, children, parent, shadow, shadowOptions) {
    super()
    this.__pending = { attr, children, parent, shadow, shadowOptions }
    // A custom element's constructor must not add attributes or children: the parser and
    // `document.createElement` both refuse the upgrade when it does (`The result must not have
    // attributes` / `must not have children`).

    // `document.createElement(tag, options)`, which connects the element while the constructor runs, and
    // building there is legal. A detached element waits for `connectedCallback` — where it becomes legal.
    if (this.isConnected) {
      this.__buildContent()
    }
  }

  connectedCallback() {
    this.__buildContent()
  }

  __buildContent() {
    const pending = this.__pending
    if (!pending) {
      return
    }
    this.__pending = null
    const { attr, children, parent, shadow, shadowOptions } = pending
    if (shadow) {
      this.attachShadow({ ...shadowOptions, mode: 'open' })
      globalThis.activateJsxInspector?.(this.shadowRoot) // support for jsx code jump when jsx-dev
    }
    let tpl = domWithScope(this, () => this.tpl(attr || {}, children, parent))
    if (typeof tpl === 'function') {
      // lazy loading support
      this.__init = () => {
        insert(this.shadowRoot || this, tpl())
      }
    } else {
      insert(this.shadowRoot || this, tpl)
    }
    this.onCreate()
  }

  onCreate() {}

  /**
   * Builds the content of the component. Override in a subclass.
   * @param {Object} attr attributes and properties passed to the component
   * @param {Array<any>} children children passed to the component
   * @param {Object} [parent] scope of the parent component (see `domWithScope`)
   */
  tpl(attr, children, parent) {
    insertAttr(attr, this, this, this)
    insert(this, children)
  }
  initState(values = {}) {
    return (this._$s = $State(values))
  }
  /*  Lazy initialize state proxy object*/
  get $s() {
    if (!this._$s) return this.initState()
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
    return this.form ? getValue(this.form) : this.$v()
  }

  setValue(v) {
    if (this.form) setValue(this.form, v)
    else this.$v(v)
  }

  mergeValue(v) {
    mergeValue(this.$v, v)
  }

  mergeState(v) {
    mergeValue(this.$s, v)
  }

  /**
   * https://gomakethings.com/the-handleevent-method-is-the-absolute-best-way-to-handle-events-in-web-components/
   * @param {*} event
   */
  handleEvent(event) {
    this[`on${event.type}`](event)
  }
}

/** web component with shadowRoot by default. mode:'open' is forced.
 *
 */
export class JsxWS extends JsxW {
  static {
    define('jsx6-wcs', this)
  }
  constructor(attr, children, parent, shadowOptions) {
    super(attr, children, parent, true, shadowOptions)
  }
}

/**
 * add a static block inside your class:
  ```js
  class MyCustomElement extends HTMLElement {
    static { define('my-custom-element', this) } 
  }
 ```
 *
 * @param {string} tag custom element tag name
 * @param {CustomElementConstructor} customElement
 */
export function define(tag, customElement) {
  if (customElements.get(tag)) {
    console.warn('JSX6E16 custom element already defined')
    // console.warn(errorMessage(JSX6E16_CUSTOM_ELEMENT_DEFINED), tag, customElements.get(tag), customElement)
  } else {
    customElements.define(tag, customElement)
  }
}
