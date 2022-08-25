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
```typescript
({"code":"initial","runner":"render_jsx"})
<>
  <h1>About</h1>
  <p>Your code goes here</p>
  <p>And you can edit the code and play with it as you follow along</p>
</>
```

This is an interactive tutorial to explain what `JSX` is behind the scenes and why it is a very useful concept. 

### Why?
I will argue that `JSX` is not only useful for React and other big libraries, and can easily be used in vanilla JavaScript with a simple function that is just few lines of code.

This tutorial can help you better understand libraries that do use `JSX`. You do not need to make your own JSX library for this tutorial to be useful to you.

Even though it is a meme now that JS community creates too many libraries, I see it as a good thing.

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
