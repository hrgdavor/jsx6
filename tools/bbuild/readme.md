
```js
import { parseArgs } from 'util'

const {
  values: { d, dev: isDev = d, n, new: isNew = n },
  positionals: [bunPath, scriptPath, ...params],
} = parseArgs({ args: Bun.argv, strict: false })

console.log(isDev)
console.log(isNew)
console.log(params)
console.log({ bunPath, scriptPath })
```
