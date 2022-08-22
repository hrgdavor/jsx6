({"option":"value"})
```
({"provides":"jsx_import.jsx"})
<h1>Hello JSX</h1>
```
# Intro

({
  "id":1
})

```jsx
({"code":"initial","runner":"render_jsx", 
  "import":"./hello.jsx", "prefix":"jsx_import.jsx"})
<h1>Hello JSX</h1>
```

This is an interactive tutorial to explain what JSX is behind the scenes and why it is useful concept. I will argue that it is not only useful for React apps but can actually be used in vanilla JavaScript with a simple function that is just few lines of code.

Although it is a meme for a long time that JS community creates too many libraries, and does it all the time, I actually think it is a good thing, and I would glad if this tutorial causes more people building libraries with JSX included.

Even if you have no plans to make your own library that uses JSX, learning in detail how JSX works and what it actually is can help you better understand any library that uses JSX.

## JSX support in different tools

```jsx
import {h} from './jsx2dom.js'
//[^1]
document.body.appendChild(<h1>Hello JSX</h1>)
```

[^1]: comment
