({"option":"value"})
```typescript
({"provides":"jsx_import.jsx"})
import { h, insert } from './jsx2dom.js'
```

```typescript
({"provides":"hello.jsx","runner":"render_jsx", "hidden":true})
<h1 class="main">Hello JSX</h1>
```


# About this tutorial

This is an interactive tutorial to explain `JSX` in more detail and also show how it works behind the scenes.

### Why?
I will argue that `JSX` can also be useful in vanilla JavaScript, and not just in React or other big libraries. Useful use cases in vanilla JS can be easily achieved with a rather short and simple function.

This tutorial can help you better understand libraries that do use `JSX`. You do not need to make your own JSX library for this tutorial to be useful to you.

### A quick look

Take a quick look at the sample code, to get a feeling of what JSX is when you write it versus what JavaScript interpreter will see.

Do not analyze it too much, it will be explained better and in more detail in the following chapters.

```typescript
({"code":"initial","runner":"render_jsx"})
<p class="intro">
{`Example code will be shown in the editor,`}<br/>
{'and'} actual {'JSX'} in the {1+1}nd editor <br/>
{'and'} rendered in <b>Output</b> section
</p>
```
The sample code above is written intentionally this way to cause specific layout in the second editor(babel transform) and output.

# JSX
```typescript
({"code":"initial", "runner":"render_jsx", "hidden":true})
<h1>JSX</h1>
```
JSX was created in **2013**, as part of React, by **Jordan Walke**. Checkout this [wiki](https://en.wikipedia.org/wiki/React_(JavaScript_library)) link for more details.

It has a lot of potential. Learn more about it in the following chapters. You really should.

## the excellent tooling support
```typescript
({"code":"initial", "runner":"render_jsx", "hidden":true})
<h1 class="main">JSX - and excellent tooling support</h1>
```
Support for `JSX` is excellent, so much so you might think it is part of the JavaScript language itself.

### esbuild - super-fast bundler

Claimed 10-100x performance boost for builds!

`JSX` is supported without plugins in [esbuild](https://esbuild.github.io/) so it can be used full speed.

Here is a quick example of esbuild with options to get started with jsx

```
 esbuild index.js --jsx-factory=h --jsx-fragment=null --loader:.js=jsx
```

### Babel 7 and libraries with JSX

[Babel](https://babeljs.io/) is widely used, much slower from esbuild but much more powerful with AST transformations.
Even if you do not use Babel directly, you are likely using it behing the scenes via webpack or some other build tool.

The [babel-plugin-jsx-simple](https://github.com/hrgdavor/babel-plugin-jsx-simple) plugin is used to convert examples in this tutorial so they can be executed in the browser as you type.

Unlike esbuild that has configurable `JSX` ouput, each library has own plugin for `JSX` transformation.

Googling for `JSX` babel plugins I was able to found these libraries that use `JSX` (there is likely more).
- [React](https://reactjs.org/) -- [babel-plugin-transform-react-jsx](https://babeljs.io/docs/en/babel-plugin-transform-react-jsx)
- [Vue](https://vuejs.org/) -- [babel-plugin-jsx](https://github.com/vuejs/babel-plugin-jsx)
- [emotionjs](https://emotion.sh/docs/introduction) -- [babel-plugin-jsx-pragmatic](https://github.com/emotion-js/emotion/tree/main/packages/babel-plugin-jsx-pragmatic) forked from [jmm](https://github.com/jmm/babel-plugin-jsx-pragmatic)
- [htm](https://github.com/developit/htm) -- [babel-plugin-transform-jsx-to-htm](https://www.npmjs.com/package/babel-plugin-transform-jsx-to-htm)


For simple usage you can configure Babel with [babel-plugin-jsx-simple](https://github.com/hrgdavor/babel-plugin-jsx-simple) or [babel-plugin-jsx-pragmatic](https://github.com/jmm/babel-plugin-jsx-pragmatic).

### editors

It is harder to find a code editor without `JSX` support that those with it. Whichever editor you prefer right now will just work.

## much more than just a template

`JSX` is a brilliant step forward from different types of template engines.

It does look like a template, but it is actually a simple transformation that makes it regular JavaScript code.

This means that there is no special template engine needed to run code inside `JSX`.

If new JavaScript syntax is added it will just work.

Exceptions and errors can easily show stack traces even inside `JSX`.

### A more complex example
```typescript
({"code":"initial", "hidden":true, "runner":"render_jsx"})
<div class="sth">
  <b>example JS:</b>
  1+1={1+1}
</div>
```

Babel option `retainLines` is good in producing code that will give real line numbers in exception traces,
but is less readable.

Here is a more complex example with manual formating to more clearly show how `JSX` compares to JavaScript
equivalent.
```typescript
({"code":"initial", "runner":"render_jsx"})
<div class="sth">      | h("div", { "class": "sth" },
  <b>example JS:</b>   |   h("b", null, "example JS:"),//b
  1+1={1+1}            |   "1+1=", 1+1
</div>                 | )//h1
```
Take a look at the code here and what babel produces in the second editor panel.
The resulting code works the same, it is just manually better aligned here to be easier to compare.


## JSX tag

Let's start with the basic example of what a single `JSX` tag looks like and how it translatest to JavaScript.

A `JSX` tag is simply converted to a `function call` where
- first parameter - is tag name
- second parameter - is an Object with those attributes
- ...rest  - are children (more on that in the next chapter)

A tag without attributes `<input/>` becomes `h("div", null)`

And with attributes
```typescript
({"code":"initial", "runner":"render_jsx"})
<input type="text" value="nice"/>
```
it becomes
```typescript
h("input", { type: "text", value: "nice" });
```

Function name I have chosen is `h` because I like a short function name here to make less visual noise
in the generated code. Also it is short for `html` which is ultimately what it represents.

## JSX tag Capitalized

To continue from the a single `JSX` tag, let's explain the special case that is used when tag
name is capitalized.

For this example we will temporarily switch to displaying the complete script that is needed to put some JSX into a document.


When tag name is capitalized JavaScript code that is generated is different in a very small way but with very useful consequences.

```typescript
<tagName/>  |  h("tagName",null)
<TagName/>  |  h(TagName, null)
```
This changes the first parameter from string to a reference, and the side-effect depend on what tha reference points to.

In React, this is used to pass reference to a component, which is then created instead of the usual simple DOM element.

In our example we do not have a component library, so to demonstrate the effects we are declaring a variable capitalised
and assigning different html tag depending if ordered or unordered list is needed. I the `JSX` template part we
use our variable as tag name. Since it is capitalised, quotes are not added in the resulting JavaScript.

```typescript
({"code":"initial"})
import { h, insert } from './jsx2dom.js'

function genList(numbered){
  const TagName = numbered ? 'ol':'ul'
  return <TagName>
    <li>One</li>
    <li>Two</li>
  </TagName>
}

insert(document.body, genList())// gen unordered list  <ul>...</ul>
insert(document.body, genList(true))// gen ordered list <ol>...</ol>

```
Notice that JavaScript produced by babel `TagName` has no quotes `h(TagName, null,` and `li` the quotes are added  `h("li", null, "One")`.


## JSX tag with children

When a `JSX` tag has children they are nested as parameters of the parent tag function call.

```typescript
({"code":"initial",  "hidden":true, "runner":"render_jsx"})
<div class="sth">
  <span>
    <b>label:</b>
    <input/>
  </span>
</div>
```

```typescript
<div class="sth">   |  h("div", { "class": "sth" },
  <span>            |    h("span", null,
    <b>label:</b>   |      h("b", null, "label:"),//b is 3rd param for span
    <input/>        |      h("input", null)// input is 4th param for span
  </span>           |    ),//span is 3rd param for div
</div>              |  )//div
```

It is also important to notice that JavaScript will execute inner functions first. 
This must be done to produce values that will be then passed as parameters to the parent function call.

# JavaScript code inside JSX

The brilliant part of the `JSX` comes from how regular javascript code is mixed-in.

JSX is converted to JavaScript using few simple rules

```typescript
import { h, insert } from './jsx2dom.js'
```

## simple and clean looking translation function

How nice would id be if you could inject translations like this
```typescript
<div class="title">{t`package_info`}</div>
```

Well, it is because how javascript [template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates) work.

To call a function with regular string you need to use the function call syntax with parenthesis
```typescript
<div class="title">{t('package_info')}</div>
```
Which is not too bad, but the example at the begining of this chapter is nicer and cleaner to read.


### Sample implementation

The translation function is actually trivial to implement, and you can change where it gets the translations from

```typescript
({"code":"initial"})
import { h, insert } from './jsx2dom.js'

const TRANS = {'package_info':'Package Information'}

const t = (code)=>{
  if(code instanceof Array) code = code[0] // when used with template literals
  return TRANS[code] || code
}

insert(document.body,<div class="title">{t`package_info`}:</div>)
insert(document.body,<div class="title">{t('package_info')}:</div>)

insert(document.body,<div class="title">{t`missing_translation`}:</div>)

```
