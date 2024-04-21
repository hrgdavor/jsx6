
## filters 

During copy task you can transform the copied file content using filters.

config for filter contains
- `filter` - function that transforms and returns new value, but can return `undefined` to say no changes happened
- `include` - list of include glob patterns
- `exclude` - list of exclude glob patterns

example filter

```js
const changeBg = {
  include: ['index.html'],
  exclude: [],
  filter: str => {
    let srch = 'background: #eee;'
    if (str.includes(srch)) return str.replace(srch, 'background: blue;')
  },
}
```
