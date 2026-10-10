# Setup: from `bun add` to a running app

## 1. Install

```sh
bun add @jsx6/jsx6 @jsx6/signal @jsx6/w
```

That is the whole dependency list for the base stack: `@jsx6/jsx6` brings the JSX runtimes and
`@jsx6/signal-dom` with it, and `@jsx6/w` brings the component base class. `@jsx6/signal` itself has
**zero dependencies** ([libs/signal/package.json](../../libs/signal/package.json)).

The `@jsx6/*` packages are versioned in lockstep — see [MODULE_VERSIONING.md](../../MODULE_VERSIONING.md).
`@jsx6/jsx6`, `@jsx6/signal`, `@jsx6/w`, `@jsx6/jsx-runtime` and `@jsx6/jsx-dev-runtime` ship **raw ESM
source** (`index.js` → `src/*.js`, plus generated `dist/*.d.ts`), so nothing in `node_modules` needs a
JSX transform.

## 2. Build: JSX is the only requirement

The libraries need no plugin and no compiler of their own; they need a bundler that can transform JSX.
This is the configuration both apps in this repository build with:

[../../apps/nodditor/src_build/esbDef.js](../../apps/nodditor/src_build/esbDef.js#region:esbDef)

```js
export const esbDef = {
  tsconfig: `tsconfig-custom.json`,
  jsx: 'automatic',
  jsxImportSource: '@jsx6',
  format: 'esm',
  loader: { '.js': 'tsx', '.jsx': 'tsx' },
  bundle: true,
  minify: true,
  skipExisting: true,
  sourcemap: true,
}
```

What each line is for:

| option | why |
| --- | --- |
| `jsx: 'automatic'` + `jsxImportSource: '@jsx6'` | `<div/>` compiles to `jsx('div', …)` from **`@jsx6/jsx-runtime`**, which calls `toDom` — the DOM is built, not described |
| `jsxDev: true` (dev builds only) | resolves `@jsx6/jsx-dev-runtime` instead: errors are logged with `file:line:column`, and a right-click in the page can jump to the JSX source |
| `loader: { '.js': 'tsx', '.jsx': 'tsx' }` | lets `.js`/`.jsx` files contain JSX (this repository keeps JSX in both) |
| `format: 'esm'` | the packages are ESM; the CJS entry (`cjs/index.js`) exists only for `require` |
| `tsconfig: 'tsconfig-custom.json'` | see below — the near-empty config given to esbuild so the editor's `jsx: "preserve"` cannot fight it |

With the esbuild CLI the same thing is:

```sh
esbuild src/index.jsx --bundle --format=esm --outdir=build --jsx=automatic \
  --jsx-import-source=@jsx6 --loader:.js=tsx --loader:.jsx=tsx
```

## 3. TypeScript and the editor

The apps keep two tsconfigs. `tsconfig.json` is what the editor and `tsc` (declaration emit) read:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@jsx6",
    "allowJs": true,
    "target": "ESNext",
    "module": "node16",
    "moduleResolution": "node16"
  },
  "include": ["index.js", "src"]
}
```

* `"jsx": "preserve"` — TypeScript must not emit JSX; the bundler does the transform.
* `"jsxImportSource": "@jsx6"` — makes the editor resolve `@jsx6/jsx-runtime` types for your JSX.
* `apps/nodditor/tsconfig-custom.json` is literally `{}`: esbuild is pointed at it so it cannot pick up
  `"jsx": "preserve"` from the real config ([typescript.notes.md](../../typescript.notes.md)).

If you run tests with Bun, `bun test` transforms JSX itself and reads `bunfig.toml` **from the process
cwd**, so the package that contains the tests needs:

```toml
jsxImportSource = "@jsx6"
```

Without it Bun defaults to React and fails on a missing `jsxDEV`/`Fragment`
([apps/nodditor/bunfig.toml](../../apps/nodditor/bunfig.toml)).

## 4. Mount the application

`insert(parent, child)` is the single insertion primitive — it normalises components, arrays and
signals, and returns what it inserted. `addToBody`/`addToHead` are the one-line aliases:

```jsx
import { addToBody, insert } from '@jsx6/jsx6'

addToBody(<div class="app">{/* your app */}</div>)
// same as insert(document.body, …)
```

JSX fragments work (`<>…</>` returns the children), and so does a document that wires things up after
upgrade: the components are custom elements, so a host without JSX can declare `<my-thing>` in HTML and
set its properties from JS.

## 5. What you do not need

* **No SSR.** Server-side rendering is explicitly unsupported; there is no hydration path and no
  compromise made for one ([README.md](../../README.md#L83)).
* **No signal compiler/plugin.** Signals are plain functions; the transform only handles JSX.
* **No special jsx6 bundler plugin** — the same options work in esbuild, Vite or Rollup, as long as the
  automatic runtime is pointed at `@jsx6`.
* **No node_modules transform**: the published packages contain no JSX.

## 6. Verify the setup

```sh
bun run dev                    # or however your app starts; the page should render
cd libs/jsx6 && bun check      # type-check the package you are working in
```

Type checking is Bun's built-in checker: it reads that directory's `tsconfig.json`, uses all cores, and
never writes files. Declaration emit is the only thing left for `tsc`, and on Windows a bare `tsc` may
be the *Service Control* executable, not TypeScript — so always go through Bun, which resolves the
workspace copy ([README.md](../../README.md#L91)):

```sh
cd libs/jsx6 && bun run types  # tsc, emits dist/*.d.ts only
```

If the page renders but nothing is reactive, the usual causes are a `jsxImportSource` that points at
React's runtime, or an attribute written with a capitalised handler name in a codebase that expects
lowercase (both work, but the repository convention is `onclick`, `onne-move-done`, …). See
[agent-rules.md](./agent-rules.md).

Next: [signals.md](./signals.md) for the reactivity model, then [components.md](./components.md) for JSX
and the DOM contract.