# signal-inspect — the dev-console demo page

A page whose only job is to give you **real signals to expand in the browser console**, one of every
shape the library has, on both shipped cores.

```bash
bun experiments/signal-inspect/serve.js                # build + serve on http://127.0.0.1:5310/
bun experiments/signal-inspect/serve.js --port=5320
bun experiments/signal-inspect/serve.js --build-only    # just rebuild dist/demo.js
bun experiments/signal-inspect/smoke.js                 # headless check of the page (10 checks)
```

The bundle is deliberately **not minified** and ships a sourcemap: the point of the page is to inspect
this library, so the Sources panel should be readable.

## What makes `console.log($sig)` work

A signal is a function, and Chrome renders a function value as a clickable source snippet: it lists none
of the function's own properties and does not run custom formatters for it. So a property on a signal — and
a formatter — cannot make a *bare* signal readable there. This page uses the library's console
interception:

```js
core.installConsoleInspection()          // the page does this on load, with showCallSite: true
console.log('count is', $count)          // count is {signal, kind, value, read, raw}
```

Your call site does not change, nothing needs enabling, there is no cost on any signal read or write, and
non-signal arguments pass through untouched. It stays opt-in in real projects, because it patches global
console methods. The trade-off is that DevTools attributes entries to the wrapper, so
`showCallSite: true` appends `(logged from …)` and `console.log.original` is kept. Press **toggle console
inspection** to see the difference, or <code>demo.hasConsoleInspection()</code>.

The zero-mechanism fallback always works: `console.log($count.value)` — the non-enumerable getter on every
signal — or `demo.describe($count)` for the described object by hand.

**The proxy route is gone, and the numbers are why.** Making each handle a transparent `Proxy` is the only
way to get DevTools' own formatters to read a function-valued signal, and it worked — but it put a trap on
every read: 2M write+read **26.75 → 349.93 ms (+1208 %)**, a 3-deep chain **+457 %**, computed reads
**+2373 %**. Console interception gives the same readable entry for none of that, so the proxy mode and the
custom formatter that only existed to render it were removed. The measurements stay in
[`changes.md`](../../libs/signal/doc/computed/changes.md) as the reason.

## What to try

| what | what you should see |
| --- | --- |
| `console.log($count)` — as written | `{signal: '…', kind: 'signal', value: 1, read: ƒ, raw: ƒ}` |
| `toggle console inspection` | with it off, a signal logs as the function it is (source in Chrome) |
| `demo.describe($double)` | the described object by hand; `.value` is a snapshot, `.read()` is current |
| `demo.label($user)` | the one-line form: `$State = {"name":"Ada","age":36}` |
| `log a snapshot and the signal`, then `write $count` twice, then expand the **earlier** entry | the number in the text is frozen, the described object keeps its logged value, `read()` is current |
| `print enumeration facts` | the `value` getter is non-enumerable: `Object.keys` gives `['get']`, spread and JSON omit it |
| `create a cyclic computed`, then read it | the guard returns the previous value and reports the cycle **once** — no hang, no overflow |
| `$user` (a `$State`) | a proxy: fields are `$user.name.value`, the snapshot is `$user()` or `String($user)` |
| `$static` | a `staticSignal` has **no** `value` getter — `describeSignal` still reads it, by calling it |
| `make an alien computed` | alien nodes are not jsx6 signals, so neither mechanism describes them; `core.toSignal(...)` bridges them |
| `@jsx6/signal-alien` button | the other core, same contract, same inspection behaviour |

Typed at the console for you: `$count`, `$base`, `$double`, `$eager`, `$sum`, `$label`, `$user`,
`$static`, `$duck`, `core` (the active core module), `cores` (both), `signals` (all of them by name),
`demo` (the page's small API, including `demo.activate('alien')`).

Useful one-liners:

```js
core.signal(5)                          // make a signal from the console
core.$C(() => $count() * 100)           // a computed made from the console
Object.getOwnPropertyDescriptor($count, 'value')   // getter, non-enumerable, read-only
$count()                                // the supported read, for a strict snapshot in code
$count.value                            // what any tooling reads, including the console wrapper
demo.label($count)                      // the one-line form: 'signal $count = 1'
```

## Why the page is not a test

The library has its own suites; this page exists for the thing tests cannot check — how it *feels* to
inspect a signal in DevTools. `smoke.js` still runs the bundle headlessly, so the page cannot rot: it
asserts the globals exist, that the table really is reactive, that `value` is a non-enumerable getter,
that the snapshot/signal distinction is real, that the cycle report appears exactly once, that console
interception is installed with the original method kept, and that switching cores changes nothing about
any of it.

Three findings from writing this page are worth knowing, and all are pinned in the smoke test:

* **`observeNow` observes only real signals.** A plain `() => $count()` arrow is a *static value* to the
  core — the "any function prop is a signal" rule lives in jsx6's DOM layer, not in the signal core — so
  the callback would receive the arrow itself. Table rows here bind the signal, not a wrapper.
* **A binding may have nothing to unsubscribe.** `observeNow` returns `undefined` for static values,
  Promises/Observables, and `staticSignal` (whose subscribe is a no-op), exactly like the library's own
  `addDisposer`, which accepts `Function|undefined`. The demo guards, as consumers should.
* **A `value` getter on a function is not visible in Chrome's console**, because Chrome presents functions
  as source snippets and lists none of their own properties. That is what led to the console
  interception — and, on the way, to describing a signal without touching its getters: `$State` is a proxy
  whose `get` trap creates a child signal for any unknown key, so `describeSignal` reads names through
  `Object.getOwnPropertyDescriptor` instead of `obj.label` / `obj.name`. The smoke test asserts that
  describing a state leaves it untouched.

## Files

| file | role |
| --- | --- |
| `index.html` | the page: live table, buttons, and the list of things to try |
| `demo-src.js` | the demo source — bundled, never loaded directly by the browser |
| `serve.js` | esbuild bundle + `Bun.serve` static server (this directory only, path-traversal guarded) |
| `smoke.js` | builds the bundle, boots it in happy-dom, asserts the page's promises (11 checks) |
| `verify-serve.mjs` | checks a running server over HTTP (routes, content types, path-traversal guard) |
| `dist/demo.js` | generated (gitignored, like the other experiment outputs) |