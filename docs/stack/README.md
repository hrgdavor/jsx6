# The jsx6 stack: `@jsx6/jsx6` + `@jsx6/signal`

This is the instruction set for building an application on the two packages this repository treats as
its base stack:

* [`@jsx6/signal`](../../libs/signal/README.md) — reactivity. Signals are **functions**; there is no
  compiler and no dependency plugin.
* [`@jsx6/jsx6`](../../libs/jsx6/README.md) — JSX and the DOM. JSX produces real DOM nodes, and the
  reactive parts are bound per node, attribute and text node.

[`@jsx6/w`](../../libs/w/README.md) supplies the component base class (`JsxW`) that goes with them, and
the JSX runtime (`@jsx6/jsx-runtime`, reached through the build, not by importing it) is what turns
`<div/>` into `toDom('div', …)`.

What the stack deliberately does **not** have:

* no SSR, no hydration, no server rendering — this is for applications, not for crawled pages
  ([README.md](../../README.md#L83));
* no bundler plugin, no compiler pass and no Babel/SWC transform beyond plain JSX support
  ([README.md](../../README.md#L5));
* no virtual DOM: an update writes the DOM node it was bound to, and nothing else.

## Who this is for

**People**: read the pages in order, and run the examples — every sample below is either injected from a
real file in this repository or is a runnable example whose code you can copy.

**Agents**: read [agent-rules.md](./agent-rules.md) first. It lists the rules that break silently when
ignored, and the commands that verify a change.

## The shape of an app

```jsx
import { insert } from '@jsx6/jsx6'
import { signal } from '@jsx6/signal'
import { JsxW, define } from '@jsx6/w'

const $count = signal(0)

class Counter extends JsxW {
  static {
    define('x-counter', this)
  }
  tpl(attr) {
    super.tpl(attr)
    return <button onclick={() => $count($count() + 1)}>clicked {$count} times</button>
  }
}

insert(document.body, <Counter />)
```

`$count` is a function: `$count()` reads, `$count(v)` writes. `{$count}` as a child binds exactly one
text node to it, so clicking the button rewrites that text node and touches nothing else. This exact
program is expanded, with assertions, in [components.example.jsx](./components.example.jsx) — see
[components.md](./components.md).

## Pages

| page | what it covers |
| --- | --- |
| [setup.md](./setup.md) | installing the packages, the esbuild/JSX/tsconfig configuration a consumer needs, mounting an app, the dev loop |
| [signals.md](./signals.md) | the reactivity core: `signal`, `$S`/`$F`, `$C`/`$CE`, `$State`, `batch`, subscriptions and their rules |
| [components.md](./components.md) | JSX, function components, `JsxW`, the attribute contract, signal→DOM binding, `Loop`, disposal, forms |
| [agent-rules.md](./agent-rules.md) | the hard rules and the verification commands, for agents and for review |

Package-level reference documentation lives with each package: [libs/jsx6](../../libs/jsx6/README.md),
[libs/signal](../../libs/signal/README.md), [libs/w](../../libs/w/README.md); the API map is
[docs/api.md](../api.md).

## Running the examples in this folder

The examples are documentation that happens to assert. Plain-JS examples run directly; examples with
JSX go through a runner that sets up a DOM and the JSX transform:

```sh
node docs/stack/signals.example.mjs      # @jsx6/signal only, no DOM
node docs/stack/components.run.mjs       # JSX + components, runs components.example.jsx
```

Both write nothing outside `.tmp/`. They are named `*.example.*`, not `*.test.*`, on purpose: `bun test`
discovers `*.test.*` across the whole tree, and these need their DOM installed before they are imported
(the runner does that).

## Add-ons

The stack has optional, independently usable pieces. Two are documented next to their code:

* [`@jsx6/dom-observer`](../../libs/dom-observer/doc/README.md) — shared `IntersectionObserver` /
  `ResizeObserver`, so observing hundreds of elements does not create hundreds of observers.
* `@jsx6/signal-dom` (batched signal→DOM helpers) and `@jsx6/signal-clock` (clock/duration signals) —
  see [docs/api.md](../api.md) and their package READMEs.

`apps/nodditor` is built on this stack end to end; its host guide is
[apps/nodditor/doc/getting-started.md](../../apps/nodditor/doc/getting-started.md).

## Keeping these pages true

Every injected block is copied from a real file by
[`@hrg/inject-examples`](https://github.com/hrgdavor/inject-examples):

```sh
bun run docs:inject         # rewrite the fenced blocks from their sources
bun run docs:inject:check   # fail when any block has drifted
bun run docs:examples       # run every runnable example in `docs/stack` and the packages
```

A marker line is a Markdown link whose label is the same path, with a `#region:<name>` fragment; the
fenced block right below it is the region's text, byte for byte. Source files carry the regions as
`// #region <name>` … `// #endregion <name>` comments.