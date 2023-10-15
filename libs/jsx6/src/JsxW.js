import { define } from './core'
import { getValue } from './getValue.js'
import { domWithScope, insert, insertAttr } from './jsx2dom'
import { mergeValue, $State } from '@jsx6/signal'
import { setValue } from './setValue.js'

/**
 * Template for a web component. If creating with shadowRoot mode:'open' is forced.
 * 
 * You can register the component automatically by using define utility. 
 * Just add a static block inside your class:
  ```js
  import { define, Jsx6W} from '@jsx6/jsx6'
  class MyCustomElement extends Jsx6W {
    static { define('my-custom-element', this) } 
  }
 ```
 this will automatically register it first time created using jsx.
 If you want to give users control over registration, or it could be used in HTML without JSX
  ```js
  import { define, Jsx6W} from '@jsx6/jsx6'
  class MyCustomElement extends Jsx6W {
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

  constructor(attr, children, parent, shadow, shadowOptions) {
    super()
    if (shadow) this.attachShadow({ ...shadowOptions, mode: 'open' })
    domWithScope(this, () => insert(this.shadowRoot || this, this.tpl(attr || {}, children, parent)))
  }

  tpl(attr, children) {
    insertAttr(attr, this, this, this, true)
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
