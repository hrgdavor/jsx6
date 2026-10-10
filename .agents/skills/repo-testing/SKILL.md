---
name: repo-testing
description: "How to run, write and verify tests in the jsx6 monorepo: bun test discovery per package, the happy-dom 14.7.1 capability limits DOM tests must work around, and the DOM test conventions. Load before touching a *.test.* file or debugging a DOM/editor test."
whenToUse: "Any task that runs, adds, changes or debugs tests in this repo, or that needs to know what the test DOM implements (custom properties, MutationObserver, canvas, layout, rAF)."
---

# Testing the jsx6 monorepo

Verified, expensive-to-rediscover facts. Everything below was measured; each claim has a way to
re-check it. Shell/sandbox limits that affect *any* verification (no browser, `oxfmt` EPERM, PowerShell
pipelines) are in the root [AGENTS.md](../../../AGENTS.md) — read that too.

## Where tests live and how to run them

| what | how |
| --- | --- |
| discovery | [scripts/verify.js](../../../scripts/verify.js) globs `**/*.test.{js,jsx,ts,tsx}` per workspace package, ignoring `dist`, `esm`, `cjs`, `build*`, `docs`, `.tmp` |
| every package | `bun run test` (root) — runs `bun test` per package **with the cwd set to that package** |
| one package | `cd apps/nodditor && bun test` |
| one file / one test | `cd apps/nodditor && bun test test/lineLayer.test.jsx -t "pick band"` |
| type check an APP | `cd apps/nodditor && bun check` — the gate's `bun check` step covers `libs/` only |
| smoke suites | `apps/nodditor/smoke/*.smoke.jsx` are **not** tests and **not** in the gate; they are committed bundles run by their `*.run.mjs` siblings |

Two rules that are easy to trip over:

- **`import './setup.js'` must be the FIRST import** of a DOM test file: `NodeEditor` extends
  `HTMLElement` at module-evaluation time, so the happy-dom globals have to exist before any editor
  source is loaded.
- **`bunfig.toml` is resolved from the cwd**, not from the directory under test, which is why the gate
  changes directory per package (and why `bun test libs/w` from the root fails on a missing `jsxDEV`).

## happy-dom 14.7.1 — the test DOM

App tests run under `@happy-dom/global-registrator`
([apps/nodditor/test/setup.js](../../../apps/nodditor/test/setup.js)). It is a DOM *implementation*, not
a browser; these are the gaps that actually bite.

| what you want to do | happy-dom 14.7.1 | do this instead |
| --- | --- | --- |
| read a custom property inline on an **attached** element | works: `getComputedStyle(el).getPropertyValue('--x')` → `"1px"` | — |
| read one from a **detached** element | `""` (the style attribute is set, the computed value is empty) | `document.body.appendChild(el)` first (remove it in the test) |
| read one **inherited from an ancestor** | `""` — custom properties do not inherit here | set the variable on the element under test |
| read one declared by a **`<style>` rule** (or a class rule) | `""` — stylesheet rules are not applied to computed custom properties | set it from JS on the element; the *stylesheet* copy of a theme is therefore not exercised by tests (see the theme tests in [lineLayer.test.jsx](../../../apps/nodditor/test/lineLayer.test.jsx)) |
| normalise a colour via `getComputedStyle(el).stroke` | returns the **literal** string (`"#ff0000"`, `"black"`), never `rgb()` | parse the text yourself — which is why [lineTheme.js](../../../apps/nodditor/src/lineTheme.js) supports hex/`rgb()`/a few keywords and falls back per variable |
| normalise a colour through a 2D canvas | `canvas.getContext` **does not exist** | same as above; there is no engine to ask |
| `MutationObserver` for **`el.style.setProperty(...)`** | **no records** (the `style` attribute does change!) | drive the code path directly, or make the test write the attribute: `el.setAttribute('style', '--x: 1px')` |
| `MutationObserver` for `setAttribute`, `classList`, `appendChild`, `textContent` | works — `attr:style` / `attr:class` / `childList` | records arrive as a **microtask**: `await new Promise(r => setTimeout(r, 0))` (the repo uses `await waitFrame()`) |
| `document.elementFromPoint` | **missing** (throws) | nothing to do: drag-hover paths that use it (e.g. `LineInteraction.hoverStep`) are a known **coverage gap** — test the surrounding logic and say so in a comment |
| `IntersectionObserver` | **undefined** — hence the stub in `test/setup.js` | keep the stub; do not delete it as "unused" |
| `ResizeObserver` | present | — |
| layout geometry | `getBoundingClientRect()` is `{0,0,0,0}` and `getComputedStyle(el).width` is `""` | treat every element as being at `0,0`; the canvas layer's `pick()` math assumes exactly that (`rect.left = 0`) |
| `requestAnimationFrame` | fires, with **0 ms latency** (next timer tick) | flush with `await new Promise(r => setTimeout(r, 50))` — the repo's `waitFrame()` |
| `devicePixelRatio` | `1`, and **writable** | set it, then restore in a `finally` |
| `matchMedia(...)` | returns an MQL; `dispatchEvent(new Event('change'))` **does** reach listeners | capture the instance by wrapping `window.matchMedia` before constructing the code under test (the layer arms its own query), then dispatch on it |
| `PointerEvent`, `Event`, `CustomEvent`, `MouseEvent`, `KeyboardEvent`, `DOMRect` | present | — |
| `MediaQueryList` as a global | **undefined** | do not `instanceof`-check an MQL |
| SVG geometry (`path.getTotalLength()`, `getBBox()`) | `undefined` | assert on the `d` text instead |

### Re-verifying a claim

- **Everything at once** — [apps/nodditor/test/happy-dom-capabilities.mjs](../../../apps/nodditor/test/happy-dom-capabilities.mjs)
  prints the whole table (deliberately not named `*.test.*`, so the gate does not run it, and `test/`
  is outside the package's `files`, so it is not published):

  ```sh
  cd apps/nodditor && bun test/happy-dom-capabilities.mjs
  ```

  Run it after touching a DOM test, and **always after bumping happy-dom**. When a row changes, fix
  the table and the tests that relied on it — never "fix" a test by weakening it.
- **One fact** — register the DOM and print it before trusting a behaviour:

  ```js
  import { GlobalRegistrator } from '@happy-dom/global-registrator'
  GlobalRegistrator.register({ url: 'http://localhost/' })
  const el = document.createElement('div')
  el.style.setProperty('--x', '1px')
  console.log('detached:', JSON.stringify(getComputedStyle(el).getPropertyValue('--x')))
  document.body.appendChild(el)
  console.log('attached:', JSON.stringify(getComputedStyle(el).getPropertyValue('--x')))
  ```

  Run it from `apps/nodditor` — that is where the registrator resolves.

### Two traps that cost real time here

Both come from trusting the spec instead of the implementation:

1. A `MutationObserver` seen "working" once is not evidence it works for the mutation you care about.
   A probe that batched `style.setProperty()` **and** `classList.add()` reported one record — which
   came from the `classList` call. Probe ONE mutation per observer (the committed probe does).
2. happy-dom custom-property support is per-element and inline-only. A theme test that "works"
   because the assertion was set on the element under test silently proves nothing about inheritance
   or stylesheets.

## Conventions these tests follow

- **Fake the GPU, never the math.** `fakeLr()` in
  [apps/nodditor/test/lineLayer.test.jsx](../../../apps/nodditor/test/lineLayer.test.jsx) pairs the REAL
  `parseLinePath`/`pickEdge`/`sampleEdgePoints` with a recording `LineRenderer` (happy-dom has no
  WebGPU at all). [libs/line-render/index.test.js](../../../libs/line-render/index.test.js) does the same
  one level down with a fake `navigator.gpu` device.
- **Restore globals** (`window.devicePixelRatio`, `window.matchMedia`) in a `finally`, or the next
  test inherits your setup.
- **When the environment is the reason for a workaround, say so in the test comment** — the repo does
  this for the theme observer (`setAttribute` instead of `style.setProperty`) and for the DPR watch.
  A future agent will otherwise "fix" the test into a failure.
- **Assert the contract, not the implementation**: what the layer rendered (the recorded edges), what
  `pick()` returned, which classes landed on the DOM. Internals move; the contract is what hosts
  depend on.
