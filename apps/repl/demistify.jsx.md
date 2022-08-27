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

JSX was created in 2013 a part of React by Jordan Walke [wiki](https://en.wikipedia.org/wiki/React_(JavaScript_library)).

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

# JSX - and excellent tooling support
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



# JSX

```typescript
({"code":"initial", "import":"hello.jsx"})

sample formatting to use to format jsx

<h1 class="main">
  JSX - and excellent tooling support
</h1>

h("h1", { "class": "main" }, 
  "JSX - and excellent tooling support"
);//</h1>

```

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
