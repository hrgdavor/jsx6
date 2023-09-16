import { define } from './core'
import { domWithScope, insert, insertAttr } from './jsx2dom'
import { mergeValue, $State } from '@jsx6/signal-state'

/**
 * Template for a web component.
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

  constructor(attr, children, parent) {
    super()
    domWithScope(this, () => insert(this, this.tpl(attr, children, parent)))
  }

  tpl(attr, children) {
    insertAttr(attr, this)
    insert(this, children)
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
}
