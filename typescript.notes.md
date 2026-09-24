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

## TypeScript 7

The repo is on TypeScript 7 (the native Go compiler, `typescript@^7.0.2`), pinned once in the root
`catalog` and consumed as `catalog:` by every package. Run it the same way as before:

```
bun x tsc --noEmit -p tsconfig.json    # per lib, as `bun run check` does
```

Two things about TS 7 matter for a JSDoc-typed codebase. Both are silent under TS 5, and both are
worked around in each lib's `tsconfig.json` rather than by annotating everything:

1. **`noImplicitAny` / `noImplicitThis` are on by default for `checkJs`.** TS 5 left them off, so
   every unannotated JS parameter or `this` becomes an error. Every lib sets both to `false` to keep
   the historical checking strength. Raise them per-lib if you ever want that stricter checking.

   `apps/repl` needs the same two flags for a different reason: its `paths` point at the libs'
   *sources*, so its `tsc` (run by `scripts/publish.js`) type-checks those files through the app's
   config and reports every unannotated parameter. `bun run pub` fails on this if they are missing.

2. **A `@param` bracket no longer makes a parameter optional for call sites.** TS 7 computes a
   function's call arity from its signature, and only a *default value* reduces it:

   ```js
   /** @param {any} a @param {any} b @param {any} [c] */
   function f(a, b, c) {}      // f(1, 2)  -> TS7 error: Expected 3 arguments, but got 2
   function g(a, b, c = undefined) {}   // g(1, 2)  -> fine
   ```

   So give genuinely optional parameters a `= undefined` (or other) default, and annotate *all*
   parameters — a function whose JSDoc covers only the leading parameters is the common trigger.

Two smaller syntax/diagnostic changes that came up while migrating:

- `function(): T` inside JSDoc braces is rejected (`TS1005`); use the arrow form `() => T`.
- A bare `Set` in a JSDoc type is rejected (`TS2314`); write `Set<any>` (or the real type argument).
- `baseUrl` was removed (`TS5102`). `paths` alone now resolves relative to the `tsconfig.json`, and
  dropping `baseUrl` changes the inferred `rootDir` — see `libs/w/tsconfig.json`, which type-checks
  only (`noEmit`) because its `paths` point at other packages' *sources*.
- `moduleResolution: "node16"` now requires an explicit matching `module` (`TS5110`) — see
  `apps/nodditor/tsconfig.json`, which is ESM and therefore uses `"module": "node16"`.
- TS 7 no longer narrows an optional value through an aliased boolean, e.g. `const has = x !== null`
  then `if (has) x.foo` (`TS18048`). Compare the value itself, or collapse to a `??` default.
- `catch (e)` bindings are `unknown` (`TS18046`); narrow with `e instanceof Error` before `e.message`.

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

