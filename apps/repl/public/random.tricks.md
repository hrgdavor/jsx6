# Spread operator

The JavaScriptCore engine has hard-coded argument limit of 65536. So beware before using spread syntax
for just about everything.

[MDN link](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax)


```typescript
({"code":"initial"})
const obj = {a:1,b:2,c:3}

// return new object that excludes certain fields
const myExclude = ({a,b, ...rest})=>rest
console.log(myExclude(obj)) // {c:3}

console.log(myExclude({a:1, name:'test'})) // {name:'test'}

```
