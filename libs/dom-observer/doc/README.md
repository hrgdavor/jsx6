# `@jsx6/dom-observer` — shared observers

`ResizeObserver` and `IntersectionObserver` both get more expensive per observed element when you create
one observer per element. This package reuses them: one observer can watch hundreds of elements, and the
callback you registered is looked up per entry. That is the whole idea, and the reason the package exists
separately from the stack ([../README.md](../README.md)).

It is a **stand-alone add-on**: no dependency on `@jsx6/signal`, `@jsx6/jsx6` or a DOM framework, and its
API is four functions.

| page | what it covers |
| --- | --- |
| [usage.md](./usage.md) | the API, the sharing rules, the disposers, the traps and the real usages in this repository |

## Quick look

```js
import { observeResize, observeShowHide } from '@jsx6/dom-observer'

// one shared ResizeObserver serves every element and callback on the page
const stopResize = observeResize(el, entry => console.log(entry.contentRect.width))

// visibility, with a show/hide threshold, shared per intersection root + options
const stopVisibility = observeShowHide(port, entry => {
  if (!entry.intersectionRatio && !port.isConnected) remove(port)
}, { root: canvas })

stopResize()
stopVisibility()
```

Every call returns the function that removes **that** callback; the element is unobserved when its last
callback is removed. There is nothing else to configure and nothing to dispose globally — but nothing is
disposed for you either (see [usage.md](./usage.md#lifecycle)).

## Run the example

```sh
node libs/dom-observer/doc/usage.example.mjs
```

It needs no DOM: the package treats an element as an opaque object, so the example uses recording
observer stubs and plain objects as elements, and asserts the sharing rules exactly. It is also the
pattern to copy when you test a consumer of this package under happy-dom 14, which has no
`IntersectionObserver` at all.

## Where it is used in this repository

| consumer | how |
| --- | --- |
| `apps/nodditor` | `observeShowHide` on block connectors, to notice a connector element leaving the DOM ([src/connectorUtil.js](../../../apps/nodditor/src/connectorUtil.js)) — the editor's only reason for depending on this package |
| `libs/popover` | `observeResize` to keep a popover positioned when its content resizes |
| `apps/repl` | `observeResize` for the frames, and `observeIntersect({ detail: 0.01 })` for the 101-threshold demo |

## Keeping the samples true

The samples are injected from real files by
[`@hrg/inject-examples`](https://github.com/hrgdavor/inject-examples) (`bun run docs:inject`,
`bun run docs:inject:check`), so they cannot drift from the code that runs.