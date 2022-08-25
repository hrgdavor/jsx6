({"option":"value"})
```typescript
({"provides":"jsx_import.jsx"})
import { h, insert } from './jsx2dom.js'
```

```typescript
({"provides":"hello_world.jsx","runner":"render_jsx"})
<h1>Hello JSX</h1>
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
{'and'} actual {'JSX'} in the second editor <br/>
{'and'} rendered in <b>Output</b> section
</p>
```
The sample code above is written intentionally this way to cause specific layout in the second editor and output.



## JSX Intro

({
  "id":1
})

```typescript
({"code":"initial", "import":"hello_world.jsx"})
```


### JSX support in different tools

```jsx
//[^1]
document.body.appendChild(<h1>Hello JSX</h1>)
```

[^1]: comment


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
