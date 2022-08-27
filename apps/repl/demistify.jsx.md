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
JSX was created in 2013 

It was created as part of React by Jordan Walke [wiki](https://en.wikipedia.org/wiki/React_(JavaScript_library)).

It has a lot of potential. Learn more about it in the follwoing chapters

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



## much more than just a template
```typescript
({"code":"initial", "runner":"render_jsx"})
<h1>JSX - much more than just a template</h1>
```

`JSX` is a brilliant step forward from different types of template engines. 

It does look like a template, but it is actually a simple transformation that makes it regular JavaScript code. 

This means that there is no special template engine needed to run code inside `JSX`. 

If new JavaScript syntax is added it will just work. 

Exceptions and errors can easily show stack traces even inside `JSX`.

## JSX tag

A `JSX` tag is simply converted to a function call where
- first parameter is tag name
- second parameter is an Object with those attributes
- rest are children (more on that in the next chapter)

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


## A more complex example
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
  <b>example JS:</b>   |   h("b", null, "example JS:")/*b*/,
  1+1={1+1}            |   "1+1=", 1+1
</div>                 | )/*h1*/;
```
Take a look at the code here and what babel produces in the second editor panel. The resulting code works the same.


# Main chapter

## subchapter 1 with content

subchapter 1 with content

## subchapter 2 with content

subchapter 2 with content


# Main chapter with content

main with content

## subchapter 1 with content

subchapter 1 with content

## subchapter 2 with content

subchapter 2 with content
