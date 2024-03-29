# WEB components 

We will describe different aspect of web components and technologies that accompany the term.

Major parts of building a [webcomponent](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) are:

- [custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements)
- [shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) 
- shadow DOM [slots](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSlotElement)
- [templates](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_templates_and_slots) - currently not interested in those while using JSX

It is interesting to know that you can use custom elements or shadow DOM independently of each other.
They are useful on their own. Using just one of them for some cases if perfectly fine and can 
make your life easier, so do not force yourself to using them both unless the combo brings you real benefit.

If you just need shadow DOM to isolate CSS, you can do that on any element, thus avoiding the need to worry
about registering a custom element.

# `display:block` and missing background

You may be accustomed making components on top of `DIV` tag that has `display:block` in browser builtin css rules, but for webcomponents this is not the case, for them it is `display: inline`. Thih might surprise you if you try to set background in some cases and nothing happens if you try to manually for example use `width:100%; height:100%` which is ignored for `inline`.


# JsxW - to help moving to web components

This move is significant shift that eliminates `.el` in code all over the place. Instead of using an old concept that was trying to avoid putting stuff on DOM nodes. Old way `Jsx6` and `Jsx6old` were making components that are objects with their own stuff and kept a reference to DOM node in `el` property. The old approach was from old `mi2js` library that was started in very different times.

When creating web components a custom tag name must be defined only once, and if not defined trying to create a web component will throw error `Illegal constructor`. Below is simple snippet that makes sure register is done and is done only once. This variant is also tree-shaking friendly.

```js
import { JsxW, define, addClass } from '@jsx6/jsx6'

export default class MyWebComponent extends JsxW {
  static {
    define('my-web-component', this)
  }
```

# tpl() and super.tpl()

in the template function tpl it is important to call `super.tpl(attr)`
```js
  tpl(attr) {
    super.tpl(attr)
    // ...
  }
```

if you want to add some default classes use provided utility `addClass` from `@jsx6/jsx6`.
```js
  tpl(attr) {
    super.tpl(attr)
    addClass(this,'MyWebComponent sth-else')
    // ...
  }
```

if you were using added class just to target the component with CSS, change the css rules to use the tag name that you must define anyway. Remove custom classname `MyWebComponent` and change css selectors from `.MyWebComponent` to `my-web-component`


if you allow inserting child nodes inside your web component you can choose to also put some html around them or not
```jsx
  tpl(attr, children) {
    super.tpl(attr)
    return (<>
      <div>title</div>
      <div class="content">{children}</div>
    </>)
  }
```

# mixins

Static initializer is the perfect place to add a mixin to a component that will affect all instances.

```js
function mixinTest(comp){
  const prototype = comp.prototype
  // reaplaceMethod will return reference to original, so you can use it to call it if needed
  let old = reaplaceMethod(prototype, 'onCreate',function(...args){
    // you can do stuff before calling the original method
    console.log('created new instance', this)    

    // call the original method and store result if needed
    let out = old.apply(this, args)// call the original

// you can manipulate return value or just pass it
    return out;
  })
}

export class MyWebComponent extends JsxW {
  static {
    define('y-web-component', this)
    mixinTest(this)
  }
```

# lifecycle events

```js
// Create a class for the element
class MyCustomElement extends HTMLElement {
  static observedAttributes = ["color", "size"];

  constructor() {
    // Always call super first in constructor
    super();
  }

  connectedCallback() {
    console.log("Custom element added to page.");
  }

  disconnectedCallback() {
    console.log("Custom element removed from page.");
  }

  adoptedCallback() {
    console.log("Custom element moved to new page.");
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log(`Attribute ${name} has changed.`);
  }
}
```
