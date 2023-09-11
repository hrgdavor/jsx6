# JSX dev runtime

to use with esbuild cli:

`--jsx=automatic --jsx-import-source=@jsx6 --jsx-dev`

or esbuild JS API:

```json
{
  jsx: "automatic",
  jsxImportSource: "@jsx6",
  jsxDev: true,
}
```

## `jsxDEV` function

Create a development element (TypeScript type).

Parameters:

*   `type` (`unknown`)
    — element type: `Fragment` symbol, tag name (`string`), component
*   `props` ([`Props`][api-props])
    — element props, `children`, and maybe `node`
*   `key` (`string` or `undefined`)
    — dynamicly generated key to use
*   `isStaticChildren` (`boolean`)
    — whether two or more children are passed (in an array), which is whether
    `jsxs` or `jsx` would be used in production runtime
*   `source` ([`Source`][api-source])
    — info about source
*   `self` (`undefined`)
    — this is used by frameworks that have components

sample source entry:

```json
{
  fileName: "src/someFile.jsx",
  lineNumber: 4,
  columnNumber: 5
}
```