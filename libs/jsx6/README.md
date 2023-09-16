JSX6


## web components tricks
vanilla JS automatic registration using static initilaizer

```js
  class MyCustomElement extends HTMLElement{
    static { customElements.define('my-custom-element', this) } 
  }
```

or let user define the component and even change the element name

```js
  class MyCustomElement extends HTMLElement {
    static define(tag='my-custom-element'){ customElements.define(tag, this) } 
  }
  // in that case user must call define before using it
  MyCustomElement.define()
```
