# Rules for agents (and for review)

This is the machine-actionable subset of the stack documentation: the rules that fail **silently** when
ignored, the commands that prove a change, and the triage order when something does not work. The other
pages explain the why — [setup.md](./setup.md), [signals.md](./signals.md), [components.md](./components.md).

## Hard rules

**Build and configuration**

1. **No SSR.** No server rendering, no prerender, no hydration path, and no compromise made for one. This
   is a project decision, not an oversight ([README.md](../../README.md#L83)).
2. **JSX must resolve to the jsx6 runtime**: `jsx: 'automatic'` with `jsxImportSource: '@jsx6'` (→
   `@jsx6/jsx-runtime`; `jsxDev: true` in dev → `@jsx6/jsx-dev-runtime`). A React runtime compiles fine
   and then fails at runtime.
3. **Keep the two tsconfigs separate**: the editor/`tsc` config uses `"jsx": "preserve"`; esbuild is
   pointed at an (essentially empty) `tsconfig-custom.json`. If esbuild reads `jsx: "preserve"` it emits
   raw JSX.
4. **`loader: { '.js': 'tsx' }`** is required in any package that keeps JSX in `.js` files.
5. **`bun test` reads `bunfig.toml` from the process cwd** — run it per package (what the root gate does),
   never `bun test apps/nodditor` from the root, or the JSX transform is not configured.
6. **Never load two copies of `@jsx6/jsx6`** on one page: the scope symbol is shared through `globalThis`
   and a second copy warns `JSX6E15` and breaks `p`/handler scoping.

**Signals**

7. `$S(fn)` / `$F(fn)` with a **single argument** is not a derived signal — it stores the function as the
   value. A derived signal needs at least one dependency: `$S(fn, $dep)`, or `$C(fn)`/`$CE(fn)` for
   auto-tracking.
8. Declare dependencies that cannot be tracked: duck-typed signals (`T`/`$T` in `@jsx6/jsx6`), promises,
   observables. With a declared dependency list the read set is collected once, so a dependency that only
   appears inside a later branch must also be declared.
9. `$sig(undefined)` is a **write**. Read with `$sig()`, `$sig.value` or `signalValue($sig)`.
10. Do not pass a name to `$C`/`$CE`: extra arguments are declared dependencies, not labels.
11. **Do not read unknown keys on a `$State` proxy** (`$s.value`, `$s.dispose`, a typo) — the read creates
    that field, and it then shows up in `$s()` and `Object.keys`.
12. `setValue($signal, v)` **reads** the signal (a function argument is called) and writes into the value
    it returns. Write with `$sig(v)`.
13. `classIf`, `setVisible`, `isVisible` and `setValue` are value-based, not signal-aware: a function is
    truthy, so the effect freezes. Wrap them: `addDisposer(el, observeNow($sig, v => classIf(el, 'c', v)))`.

**DOM and lifetime**

14. Attribute names are literal: `class`, never `className`; event listeners are `on` + the lower-cased
    event name (`onclick`), and a custom event uses its dashed name (`onne-move-done` → `ne-move-done`).
15. A **function-valued attribute is a subscription**, not a value. Only pass a function when you want
    the binding.
16. `key` is written to the DOM as a `key` attribute (and kept as `loopKey`/`$key`).
17. `disposeNode(node)` releases bindings, post-order and idempotently, and **never detaches**. Detaching
    is `remove()`/`replace()`/native DOM. Subscriptions you create yourself must be handed to
    `addDisposer` or they outlive the DOM.
18. `JsxW` has no destroy hook; `Jsx6` has `ondestroy()`. Do not invent a lifecycle method — node teardown
    is `disposeNode`.

**Documentation and examples (this is where the repository has its own gate)**

19. Every sample in a `doc/` page that carries a `#region` marker is copied byte-for-byte from the source
    by `@hrg/inject-examples`. After editing the source **or** the marker block:
    `bun run docs:inject` (rewrite) and `bun run docs:inject:check` (verify).
    A marker is a whole-line link whose label equals its target, with `#region:<name>`; the fenced block
    immediately below it is the content, and the fence language is authored (the tool keeps it).
20. **Keep runnable examples runnable.** `docs/stack/*.example.mjs` run with plain `node`; JSX examples run
    through their `<page>.run.mjs`; `bun run docs:examples` runs them all. An example that does not pass is
    a doc bug, not a test bug.
21. **Never name a doc example `*.test.*`.** `bun test` discovers `*.test.*` across the whole tree and would
    run it without the DOM globals it needs (the repository convention is `*.example.jsx`, `*.smoke.jsx`,
    `*.run.mjs`). The one exception is deliberate: `libs/signal/doc/computed/examples/*.js` are executed by
    `examples.test.js` in that package.
22. Generated example bundles go where the tooling ignores them: `.tmp/` (ignored by git and Oxfmt) or, in
    `apps/nodditor`, `doc/*.bundle.mjs` (excluded by that package's `.oxfmtrc.json` and by `.gitignore`).
    `*.md` and `docs/` are not formatted by Oxfmt at all.

## Commands

| what | command |
| --- | --- |
| the whole stack's examples | `bun run docs:examples` |
| one example | `node docs/stack/signals.example.mjs`, `node docs/stack/components.run.mjs`, `node libs/dom-observer/doc/usage.example.mjs`, `cd apps/nodditor && node doc/getting-started.run.mjs` |
| tests (discovered per package) | `bun run test` |
| fast gate: tests + JSDoc type check | `bun run check:fast` |
| full local gate (no CI exists) | `bun run check` — in a confined sandbox use `bun run check --no-format` |
| type check one package | `bun x tsc --noEmit -p libs/jsx6/tsconfig.json` |
| docs injected blocks | `bun run docs:inject:check` |
| format | `bun run format` (Oxfmt; `*.md` is not formatted) |

`bun run check` is the only gate — there is no CI ([README.dev.md](../../README.dev.md)).

## Triage

| symptom | first thing to check |
| --- | --- |
| nothing is reactive | does the JSX compile to the `@jsx6` runtime, and is the value a signal/function rather than a plain value? |
| a signal change does nothing | the `===` guard: was a new value written, or was an object mutated in place? |
| a binding still fires after the node is gone | was it created by JSX (auto-registered) or by hand (needs `addDisposer`)? |
| a derived value is stale after a branch appears | the dependency was not declared and the read set was collected once |
| a `$State` field appears out of nowhere | an unknown key was read, or `$s.value`/`$s.dispose` was touched |
| `JSX6E15` warning, broken `p`/handler scope | two copies of `@jsx6/jsx6` in the bundle |
| `tsc` says "This is not the tsc command you are looking for" | a Windows `tsc.exe` on `PATH`; use `bun x tsc` |
| esbuild fails with `spawn EPERM` | the JS API needs a piped service; use the CLI with `stdio: 'inherit'` (see [components.run.mjs](./components.run.mjs)) |
| `bunx` fails with "unable to write files to tempdir: EPERM" | restricted sandbox; run the tool from Bun's cache or with unrestricted file access |

## Where the rest of the knowledge lives

* [`AGENTS.md`](../../AGENTS.md) — the repository router: always-relevant facts and where each kind of task
  knowledge lives.
* [`docs/api.md`](../api.md) — the package-by-package API map.
* [`README.dev.md`](../../README.dev.md) — the gate, versioning, publishing, troubleshooting.
* Package references: [libs/jsx6](../../libs/jsx6/README.md) · [libs/signal](../../libs/signal/README.md) ·
  [libs/w](../../libs/w/README.md) · [libs/signal/doc/computed](../../libs/signal/doc/computed/README.md).
* Add-ons: [libs/dom-observer/doc](../../libs/dom-observer/doc/README.md).
* Applications: [apps/nodditor/doc/getting-started.md](../../apps/nodditor/doc/getting-started.md) ·
  [apps/nodditor/README.md](../../apps/nodditor/README.md).