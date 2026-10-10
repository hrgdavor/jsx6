# Using `@jsx6/dom-observer`

The package exports four functions, all of which return a disposer (except the one-shot `observeInit`):

| export | signature | callback receives |
| --- | --- | --- |
| `observeResize` | `observeResize(el, callback, { box }?)` | a `ResizeObserverEntry` — `entry.contentRect`, `entry.borderBoxSize[0].inlineSize/.blockSize` |
| `observeIntersect` | `observeIntersect(el, callback, { root, rootMargin, threshold, detail }?)` | an `IntersectionObserverEntry` — `entry.intersectionRatio`, `entry.target` |
| `observeShowHide` | `observeShowHide(el, callback, { root, rootMargin, threshold = [0, 0.0001] }?)` | the same entry; it is `observeIntersect` with the show/hide threshold already set |
| `observeInit` | `observeInit(el, callback, options?)` | the same entry, **once**, the first time the element is visible; returns `undefined` |

The emitted declarations are the authoritative types: [../dist/index.d.ts](../dist/index.d.ts)
(`bun run types` in the package regenerates them).

[usage.example.mjs](./usage.example.mjs#region:demo)

```js
// An element is opaque here; in an app it is a DOM node. An intersection `root` is both the
// intersection root and the key that shares one observer per root + options pair.
const graph = {}
const port = {}

// Report visibility changes: `observeShowHide` is `observeIntersect` with a show/hide threshold.
const stopVisibility = observeShowHide(
  port,
  entry => console.log('intersectionRatio', entry.intersectionRatio),
  { root: graph },
)

// Report size changes: one ResizeObserver is shared by every element and every callback in the page.
const stopResize = observeResize(port, entry => console.log('width', entry.contentRect.width))

// Every call returns its own disposer. The element is unobserved only when its last callback goes.
stopVisibility()
stopResize()
```

Run it: `node libs/dom-observer/doc/usage.example.mjs`. It needs no DOM — the package treats an element as
an opaque object (a key in a per-element callback map, passed on to the observer) — so the example uses
plain objects as elements and recording stubs as observers, and asserts the sharing rules below.

## What gets shared, and keyed by what

| call | shared unit | key |
| --- | --- | --- |
| `observeResize` | **exactly one `ResizeObserver` per module instance** — every element, every callback and every `box` option | none. `box` is forwarded to the first `observe()` call for an element and is not part of any key |
| `observeIntersect` / `observeShowHide` | one `IntersectionObserver` per distinct `{ rootMargin, threshold }` | the options JSON, in a pool that lives **on the `root` element**; callers that pass no `root` share one module-level pool |

Two consequences worth knowing:

* **Passing the same `root` is what makes different callers share.** The library writes its pool onto the
  root object (a module-private symbol), so a `root` you pass is mutated — and two callers that happen to
  pass the same element share the pool implicitly.
* **`root` itself is not part of the key**, because the pool is stored per root.

## Lifecycle

* Every call returns its own disposer. It removes **that callback**; the element is unobserved only when
  its last callback is removed. Calling a disposer twice is a no-op.
* Registration is **first-write-wins per element**: `observer.observe(el, options)` runs only the first
  time an element is seen, so a second `observeResize` on the same element with a different `box` is
  silently ignored. The intersection path always passes `undefined` here — its options went to the
  observer constructor.
* **Nothing is ever disconnected.** A shared observer lives as long as the module, or as long as the root
  object; the module-level pool keeps one handler per distinct `{ rootMargin, threshold }` for the process
  lifetime.
* **Detach is not observed.** There is no `MutationObserver` and no automatic cleanup: an element that
  leaves the DOM keeps its registrations until you call the disposer. What the browser delivers is a final
  entry with `intersectionRatio: 0`.

### “ratio 0” is not “removed”

The library reports entries exactly as the browser delivered them, and a hidden element and a removed
element both have `intersectionRatio === 0`. The caller decides; the canonical check in this repository is
([apps/nodditor/src/connectorUtil.js](../../../apps/nodditor/src/connectorUtil.js)):

```js
el.removeObserve = observeShowHide(
  el,
  entry => {
    if (!entry.intersectionRatio && !el.isConnected) blockData.editor.removeConnector(connectData)
  },
  { root: rootNode },
)
```

## Constraints

* **Importing the package constructs the shared `ResizeObserver`** (module scope), so
  `globalThis.ResizeObserver` must exist before the import — and `"sideEffects": false` in the manifest
  means a tree-shaking bundler is entitled to drop that module. `IntersectionObserver`, by contrast, is
  created lazily on the first call.
* `<Element>` is used as a `WeakMap` key and handed to the observer; nothing else about it is read, which
  is why no DOM is required to use or test the package.
* Under **happy-dom 14** there is no `IntersectionObserver` at all and its `ResizeObserver` is inert
  (it never fires). Tests must stub them: [apps/nodditor/test/setup.js](../../../apps/nodditor/test/setup.js)
  for the unit suites, [apps/nodditor/smoke/dom-setup.mjs](../../../apps/nodditor/smoke/dom-setup.mjs) for the
  script-style ones, and [usage.example.mjs](./usage.example.mjs) here for a drivable recording stub.
* Listener errors are caught per callback and logged
  (``problem calling IntersectionObserver listener: …``), so one throwing callback cannot stop the others.

## `detail`: a threshold ladder

`observeIntersect`/`observeShowHide` accept `detail` as a convenience: when no `threshold` is given,
`{ detail: 0.01 }` expands to `[0, 0.01, 0.02, …, 0.99, 1]` — one callback per percent. That is what
`apps/repl` uses for its demo. Note that `observeShowHide`'s destructuring does not forward `detail`; pass
`observeIntersect` directly if you want the ladder **and** the show/hide semantics are not what you need.
The same caveat applies to `observeInit`, which is `observeIntersect` with the show/hide threshold.

## Testing a consumer

Boot the globals first, then import — the package is evaluated at import time:

```js
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }

const { observeShowHide } = await import('@jsx6/dom-observer')
```

To *drive* the callbacks, keep the observer instance and call its callback with one entry per element
(`[{ target: el, intersectionRatio: 0 }]`); entries are routed to the callbacks registered for that
`target`, so the shape matches the browser. [usage.example.mjs](./usage.example.mjs) does exactly that.

## Related

* [../README.md](../README.md) — why reuse matters, with the external references the performance claim
  rests on (there is no benchmark in this repository).
* [../../signal-dom/index.js](../../signal-dom/index.js) — the batched signal→DOM helpers of the stack,
  which use `requestAnimationFrame` rather than observers.
* [docs/api.md](../../../docs/api.md) — the package map.