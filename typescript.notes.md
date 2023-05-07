# Intro

I like scripting in JS, but there are also many benefits in strong typing. 
I have not decided how far I will got with strict, but limit is when it becomes difficult, 
or in my opinion is more hassle than it is worth.

Idea is to write JS 99%, and write TypeScript only for defining interfaces and types when there is no JS Class, 

Use the VSCode provide error reporting in the editor and hints (intelisense).

## Setup

### tsconfig.json

Minimal tsconfig

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "target": "ESNext",
    "outDir": "build",
    "moduleResolution": "node16"
  },
  "exclude": ["node_modules", "build_dev", "build", "dist"]
}
```

###  VSCode intelisense issues

At this moment  `*.jsx` files have hints for method parameters, but not `*.js`. To avoid this issue open : 
`File->Preferences->Settings` and search `assoc` to get to `File associations` and add

- `*.js`->`javascriptreact`

### esbuild

If using `JSX` and not `React` then you need a copy of `tsconfig.json` called for example `tsconfig-custom.json` because you need to have `compilerOptions.jsx:"preserve"` for `tsc` to not complain and that will then make a problem with esbuild if you use `compilerOptions.jsx:"automatic"` there

## JSDoc

[JSDoc](https://jsdoc.app) will be used to define types

## TypeScript interface, type

It is more compact to write type definitions for data objects in TypeScript than in JSDoc so I write them in a file `_types.ts`

```typescript
export interface LinePoint {
  pos: Array<number>
  con: ConnectorData
  listen: Array<Function>
  align: string
}
```

### extend HTMLElement

If you need to attach custom properties to HTML elements and use compiler help you need to define an interface 

```typescript
export interface HTMLConnector extends HTMLElement {
  ncData: ConnectorData
}
```

If you use built-in browser function that returns `Element` then you need to cast the result for compiler to know it. Casting is done by in-lining `@type` JSDoc comment and also adding `()` parenthesis around the expression.

```javascript
let target = /** @type {HTMLConnector} */ (document.elementFromPoint(x, y))
let ncData = target.ncData
```

### JSDoc and imports

If type is defined in separate file you need to import the definition in JSDoc `import('./_types.js').HTMLConnector`.

```js
let target = /** @type {import('./_types.js').HTMLConnector} */ (document.elementFromPoint(x, y))
```

To avoid this noise in the code where the type is used, you can declare the type in the beginning of your file. Later when you want to use it you just reference it by Name.

```js
/** 
* @typedef {import('./_types.js').HTMLConnector} HTMLConnector
*/
.....
let target = /** @type {HTMLConnector} */ (document.elementFromPoint(x, y))
```

