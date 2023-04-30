# JSX dev runtime

to use with esbuild cli:

`--jsx=automatic --jsx-import-source=@sjx6 --jsx-dev`

or esbuild JS API:

```
{
  jsx: 'automatic',
  jsxImportSource: '@jsx6',
  jsxDev: true,
  ...
}
```