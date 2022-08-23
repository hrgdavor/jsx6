({"option":"value"})
```typescript
({"provides":"jsx_import.jsx"})
```
```typescript
({"provides":"hello_world.jsx","runner":"render_jsx"})
<h1>Hello JSX</h1>
```


# How to use this tutorial
```typescript
({"code":"initial","runner":"render_jsx"})
<h1>HOWTO</h1>
```

Bla bla

## JSX Intro

({
  "id":1
})

```typescript
({"code":"initial", "import":"hello_world.jsx"})
```

This is an interactive tutorial to explain what JSX is behind the scenes and why it is a very useful concept. 

I will argue that it is not only useful for React and other big libraries, but can actually be used in vanilla JavaScript with a simple function that is just few lines of code.

Although it is a meme for a long time that JS community creates too many libraries, and does it all the time, I actually think it is a good thing.

Even if you have no plans to make your own library that uses JSX, learning in detail how JSX works and what it actually is can help you better understand any library that uses JSX.

### JSX support in different tools

```jsx
import {h} from './jsx2dom.js'
//[^1]
document.body.appendChild(<h1>Hello JSX</h1>)
```

[^1]: comment

