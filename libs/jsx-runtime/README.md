# JSX runtime

This is implementation of `jsx-runtime` for jsx6.

to use with esbuild cli:

`--jsx=automatic --jsx-import-source=@jsx6`

or esbuild JS API:

```
{
  jsx: 'automatic',
  jsxImportSource: '@jsx6',
  ...
}
```

### `jsx`

Create a production element (TypeScript type). Called when no children or one child. Equivalent to `isStaticChildren=false` when in dev runtime.

###### Parameters

*   `type` (`unknown`)
    — element type: `Fragment` symbol, tag name (`string`), component
*   `props` ([`Props`][api-props])
    — element props, `children`, and maybe `node`
*   `key` (`string` or `undefined`)
    — dynamicly generated key to use

###### Returns

An element from your framework (`JSX.Element`).

## `jsxs`

Same as `jsx` but will be called when there is more than one child element. Equivalent to `isStaticChildren=true` when in dev runtime.

