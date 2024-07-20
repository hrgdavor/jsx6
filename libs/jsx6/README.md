JSX6


## From validation

We provide here way to walk through a form that can be used to mark validation results.
The actual code that does markging ins not in the source, but examples are provided instaed, as it may depend greatly form project to project.

Exmaple validation result:
```js
let exampleValid = window.exampleValid = {
  items:{
    name: {message:'Required', type:'required'},// validation error
    address: {},// ok
    // city: undefined,// missing key means validation has no error for that field
    contact: {// subform
      message: 'general message for subform',
      items:{
        name: {message:'Required', type:'required'},// validation error
        email: {message:'Invalid email format', type:'invalid'},// has value but it is invalid
      }
    }
  }
}
```

Example validation setup:

```js
// actual function you will use in your project
function markValid(el, vErr){
  formForEach(el, vErr, validationMarker, validationMarker)
}

// the function doing all the hard work, deciding how to convey validation information into the DOM
export function validationMarker(el, vErr){
  el = toDomNode(el)
  if(!el) return
  let err = vErr?.message
  let parent = el.parentNode
  if(!parent) {
    console.warn(el, vErr)
    throw Error('element without parent HTMLElement')
  }
  // loop can have textNode as base element, and it can not have attributes or calss
  if(el.setAttribute) classIf(el, 'validation-error', err)
  setAttribute(parent,'validation-error-message', err)
  setAttribute(parent,'validation-error-type', vErr?.message)
}

// define how components can declare a custom validation function
validationMarker.hasOverride = el=>el?.markValid
// call the custom validation function
validationMarker.callOverride = function(el, vErr){
  if(el?.markValid){
    try{
      el?.markValid(vErr)
    }catch(e){
      console.error('problem with ',el,'.markValid',e)
    }
  }
}
```


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
