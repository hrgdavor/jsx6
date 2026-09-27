# nodditor ↔ jsx6 dependency inventory (for the vanilla-JS path)

Purpose: a reviewable inventory of every jsx6 primitive the editor depends on, where it is used, and
how cheap it would be to remove. The goal is to decide what a *standalone / vanilla-JS* nodditor
should still need from jsx6, and what is incidental.

Sources of truth:

- [apps/nodditor/src/runtime-default.js](../apps/nodditor/src/runtime-default.js) — the only file in
  the package that imports `@jsx6/*`; the contract is exactly its export list.
- [apps/nodditor/src/runtime.js](../apps/nodditor/src/runtime.js) — the `NodeEditorRuntime` typedef.
- [apps/nodditor/smoke/essential.smoke.js](../apps/nodditor/smoke/essential.smoke.js) — drives the
  **vanilla demo** (no JSX, no component model, no signals) under happy-dom with a recording backend,
  and prints the call counts used below. Run with `node smoke/essential.run.mjs`.
- Call sites are the `backend.current.*` references in `apps/nodditor/src/**`.

> **Status.** The contract is **21 primitives**, of which a full vanilla session calls **18**.
> Every name below is a live dependency of the editor or of the block components — there are no
> placeholder or historical entries.
> `src/runtime-default.js` is the only module in the package that imports `@jsx6/*`; that is asserted
> for *every* source file, with no exemptions, by
> [test/runtime.test.js](../apps/nodditor/test/runtime.test.js) and the `SEAM-1` check in
> [smoke/seam.smoke.jsx](../apps/nodditor/smoke/seam.smoke.jsx). The demo page and its block
> components are ordinary consumers of the editor's public API.

## 0. Summary

21 primitives across 4 packages. "Engine call sites" = calls by `NodeEditor` and its non-block
modules; "Vanilla calls" = counts measured by
[smoke/essential.smoke.js](../apps/nodditor/smoke/essential.smoke.js) in a full vanilla session.

| #   | Primitive         | Package      | Engine call sites | Vanilla calls     | Replacability                        |
| --- | ----------------- | ------------ | ----------------- | ----------------- | ------------------------------------ |
| 1   | `addClass`        | jsx6         | 3                 | 2                 | ⚠ **not trivial** — see §1.0         |
| 2   | `classIf`         | jsx6         | 5                 | 44                | trivial native (`classList.toggle`)  |
| 3   | `findParent`      | jsx6         | 5                 | 0 (pointer paths) | trivial native loop                  |
| 4   | `fireCustom`      | jsx6         | 3                 | 56                | trivial native (`CustomEvent`)       |
| 5   | `getAttr`         | jsx6         | 3                 | 126               | trivial native                       |
| 6   | `hSvg`            | jsx6         | 3                 | 34                | small native helper                  |
| 7   | `insert`          | jsx6         | 9                 | 30                | small native helper                  |
| 8   | `isNode`          | jsx6         | 2                 | 121               | trivial native                       |
| 9   | `listen`          | jsx6         | 4                 | 95                | trivial native                       |
| 10  | `listenCustom`    | jsx6         | 6                 | 44                | trivial native                       |
| 11  | `remove`          | jsx6         | 3                 | 26                | trivial native (see caveat)          |
| 12  | `runFuncNoArg`    | jsx6         | 4                 | 163               | trivial native                       |
| 13  | `setAttribute`    | jsx6         | 2                 | 42                | trivial native                       |
| 14  | `setSelected`     | jsx6         | 1                 | 17                | attribute convention, not API        |
| 15  | `setVisible`      | jsx6         | 5                 | 4                 | trivial native (`hidden`)            |
| 16  | `toDomNode`       | jsx6         | 1                 | 15                | small native helper                  |
| 17  | `$Or`             | signal       | 1                 | 1                 | replace or drop (see §4)             |
| 18  | `observeNow`      | signal       | 1                 | 1                 | replace or drop (see §4)             |
| 19  | `JsxW`            | w            | structural (1)    | n/a               | the real coupling (see §3)           |
| 20  | `define`          | w            | structural (1)    | n/a               | trivial native                       |
| 21  | `observeShowHide` | dom-observer | 1                 | 27                | feature decision (see §6)            |

Verdict up front: **11 of the 21 are one-line native reimplementations**, 1 (`addClass`) is a small
helper with semantics that are easy to get wrong, 1 is an attribute convention, and only
**`JsxW` + its `$s` state + `observeShowHide`** carry real behaviour. A vanilla-only nodditor could
plausibly depend on **one** jsx6 concept (a component base class) or none at all.

## 1. `@jsx6/jsx6` — 16 primitives (the bulk)

### 1.0 `addClass` — read this before "simplifying" it

`addClass` has two modes and only one of them is obvious:

```js
// libs/jsx6/src/addClass.js
node = toDomNode(node) || {}
let cl = node.classList
if (cl) { … cl.add(add) }                                    // element: classList.add
else if (isObj(node)) {                                      // plain props object: MERGE a string
  cl = node['class'] || ''
  node['class'] = cl ? cl + ' ' + add : add
}
```

The second mode is why it cannot be replaced by writing `class="ne-block"` in JSX. A block component
receives the host's props and must **extend** `attr.class`, not overwrite it: the JSX runtime applies
props in insertion order (`for (let a in attr)` in `libs/jsx6/src/jsx2dom.js:217`), so a literal
`class=` that gets applied after the spread wins, and the host's class is lost. Measured in the seam
suite:

```
ok SEAM-6 a host class is merged, not overwritten (class="vb ne-block")
```

That assertion is what keeps this honest: `editor.add(<Switch class="vb" />, …)` proves the merge
survives whatever a host passes in. Call sites:

| File | Line | Mode |
| ---- | ---- | ---- |
| [blocks/Switch.js](../apps/nodditor/src/blocks/Switch.js#L11) | `backend.current.addClass(attr, 'ne-block')` | props object |
| [blocks/Message.js](../apps/nodditor/src/blocks/Message.js#L6) | `backend.current.addClass(attr, 'ne-block')` | props object |
| [EditableTitle.js](../apps/nodditor/src/EditableTitle.js#L7) | `backend.current.addClass(attr, 'EditableTitle')` | props object |

All three callers pass a props **object**, never an element — so a replacement backend must implement
the object branch, and an implementation that only does `classList.add` will silently drop the class.

### 1.1 Zero-cost / trivial replacements

These have call sites in the engine but no behaviour worth preserving.

| Primitive      | Call sites | Native replacement                                         | Notes                                                                                  |
| -------------- | ---------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `classIf`      | [NodeEditor.jsx:560](../apps/nodditor/src/NodeEditor.jsx#L560) `.focused`; [:1005](../apps/nodditor/src/NodeEditor.jsx#L1005) `at-min`; [:1006](../apps/nodditor/src/NodeEditor.jsx#L1006) `at-max`; [:1249](../apps/nodditor/src/NodeEditor.jsx#L1249) `ne-from-sel-block`; [:1250](../apps/nodditor/src/NodeEditor.jsx#L1250) `ne-to-sel-block`; [LineInteraction.js:28](../apps/nodditor/src/LineInteraction.js#L28) `target`; [ConnectLine.js:162](../apps/nodditor/src/ConnectLine.js#L162) `selected` | `el.classList.toggle(name, !!on)` | accepts a signal or a boolean; the engine only ever passes a boolean/expression |
| `findParent`   | [NodeEditor.jsx:643](../apps/nodditor/src/NodeEditor.jsx#L643), [:816](../apps/nodditor/src/NodeEditor.jsx#L816), [:817](../apps/nodditor/src/NodeEditor.jsx#L817), [:825](../apps/nodditor/src/NodeEditor.jsx#L825), [:895](../apps/nodditor/src/NodeEditor.jsx#L895) | `while (p) { if (pred(p)) return p; p = p.parentElement }` | 5 sites, all pointer/context-menu handlers |
| `fireCustom`   | [NodeEditor.jsx:1454](../apps/nodditor/src/NodeEditor.jsx#L1454), [:1455](../apps/nodditor/src/NodeEditor.jsx#L1455) (the `fireCustom(el,…)` method), [EditableTitle.js:13](../apps/nodditor/src/EditableTitle.js#L13) | `el.dispatchEvent(new CustomEvent(name, { detail }))` | ⚠ the engine fires **unbatched** `CustomEvent`s (no `bubbles`); the real one matches. Any replacement must keep that, because hosts listen on the editor element |
| `getAttr`      | [connectorUtil.js:43](../apps/nodditor/src/connectorUtil.js#L43) `ncid`, [:52](../apps/nodditor/src/connectorUtil.js#L52) `ne-connect`; [NodeEditor.jsx:658](../apps/nodditor/src/NodeEditor.jsx#L658) `nid`, [:819](../apps/nodditor/src/NodeEditor.jsx#L819) `nid` | `el.getAttribute(name)` | highest call count (126) — it is the connector-discovery inner loop |
| `isNode`       | [NodeEditor.jsx:289](../apps/nodditor/src/NodeEditor.jsx#L289); [listenUntil.js:23](../apps/nodditor/src/listenUntil.js#L23) | `v?.nodeType !== undefined` | 121 calls, all from the discovery/disposer paths |
| `listen`       | [NodeEditor.jsx:919](../apps/nodditor/src/NodeEditor.jsx#L919) `keydown`, [:924](../apps/nodditor/src/NodeEditor.jsx#L924) `focusin`, [:925](../apps/nodditor/src/NodeEditor.jsx#L925) `focusout`; [listenUntil.js:6](../apps/nodditor/src/listenUntil.js#L6) | `addEventListener` returning an unsubscribe closure | the closure is what `addFinalizer` stores |
| `listenCustom` | [listenUntil.js:10](../apps/nodditor/src/listenUntil.js#L10); [ConnectLine.js:78](../apps/nodditor/src/ConnectLine.js#L78), [:81](../apps/nodditor/src/ConnectLine.js#L81), [:84](../apps/nodditor/src/ConnectLine.js#L84) | `addEventListener(name, e => cb(e.detail, e))` | **must unwrap `e.detail`** — a plain `addEventListener` breaks line-follows-connector |
| `remove`       | [NodeEditor.jsx:333](../apps/nodditor/src/NodeEditor.jsx#L333) (line), [:380](../apps/nodditor/src/NodeEditor.jsx#L380) (block), [:730](../apps/nodditor/src/NodeEditor.jsx#L730) (marquee) | `el.parentNode?.removeChild(el)` | ⚠ caveat: jsx6's `remove` also runs its disposer chain. The editor does its own `finalize()` and only ever removes plain block elements — but a host returning an *upgraded* custom element relies on that disposer |
| `runFuncNoArg` | [ConnectLine.js:54](../apps/nodditor/src/ConnectLine.js#L54), [:55](../apps/nodditor/src/ConnectLine.js#L55), [:66](../apps/nodditor/src/ConnectLine.js#L66); [listenUntil.js:21](../apps/nodditor/src/listenUntil.js#L21) | `fn => typeof fn === 'function' && fn()` | 163 calls — the disposer arrays are hot |
| `setAttribute` | [NodeEditor.jsx:121](../apps/nodditor/src/NodeEditor.jsx#L121) `nid`; [connectorUtil.js:83](../apps/nodditor/src/connectorUtil.js#L83) `ne-nodrag` | `el.setAttribute(name, value)` | jsx6's version nulls/removes on `false`/`null`; the two call sites pass strings/`true` |
| `setVisible`   | [NodeEditor.jsx:832](../apps/nodditor/src/NodeEditor.jsx#L832), [:833](../apps/nodditor/src/NodeEditor.jsx#L833), [:1221](../apps/nodditor/src/NodeEditor.jsx#L1221), [:1223](../apps/nodditor/src/NodeEditor.jsx#L1223), [:1231](../apps/nodditor/src/NodeEditor.jsx#L1231) | toggle the `hidden` attribute | only ever the selection menu; 4 calls |

### 1.2 Small helpers worth one local module (not jsx6-specific behaviour)

| Primitive                | Call sites                                                             | What it does                                                             | Replacement                                                                          |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `hSvg`                   | [NodeEditor.jsx:523](../apps/nodditor/src/NodeEditor.jsx#L523) (the `<svg>` layer); [ConnectLine.js:15](../apps/nodditor/src/ConnectLine.js#L15) (`<g>` + two paths); [svgUtil.js:9](../apps/nodditor/src/svgUtil.js#L9) (`<path>`) | `createElementNS` + attribute/children insertion | ~10 lines, three call shapes |
| `insert`                 | [NodeEditor.jsx:126](../apps/nodditor/src/NodeEditor.jsx#L126) block, [:551](../apps/nodditor/src/NodeEditor.jsx#L551)/[:552](../apps/nodditor/src/NodeEditor.jsx#L552) zoom UI + status, [:765](../apps/nodditor/src/NodeEditor.jsx#L765) marquee, [:837](../apps/nodditor/src/NodeEditor.jsx#L837)/[:1226](../apps/nodditor/src/NodeEditor.jsx#L1226) menu, [:1075](../apps/nodditor/src/NodeEditor.jsx#L1075) line into svg | normalises *element \| component (`.el`) \| array \| string* and inserts | the engine only passes elements **plus whatever `editor.add()` was handed** — the component case is exactly the `toDomNode` question below |
| `toDomNode`              | [NodeEditor.jsx:122](../apps/nodditor/src/NodeEditor.jsx#L122) (`add`) | same normalisation, returns the node                                     | if the host contract says "pass an element", this collapses to `block.el ?? block`   |
| `setSelected`            | [NodeEditor.jsx:1244](../apps/nodditor/src/NodeEditor.jsx#L1244)       | sets the `selected` attribute on the block                               | the app's CSS is `[selected]`, so this is an **attribute convention**, not an API need — a host can write it |

### 1.3 Notes on the remaining `@jsx6/jsx6` entries

- `provideErrTranslations` (error-message strings) exists in `@jsx6/jsx6` but the editor never calls
  it — the demo page no longer does either, and the editor's own errors are plain `Error`s. It is
  simply not part of the contract.
- `toDomNode`/`insert` are the only two that normalise *components* (`.el`) and arrays; that is the
  behaviour to preserve if they are ever replaced.
- Generic helpers in `@jsx6/jsx6` that the editor never calls directly (predicates, translation
  helpers) are not in the contract: the editor reaches them only through `JsxW`'s internals.

## 2. `@jsx6/signal` — `$Or`, `observeNow`

Two primitives in the contract, **two call sites in the engine**.

| Primitive    | Call sites                                                     | Audit calls | Analysis                  |
| ------------ | -------------------------------------------------------------- | ----------- | ------------------------- |
| `$Or`        | [NodeEditor.jsx:559](../apps/nodditor/src/NodeEditor.jsx#L559) | 1           | `this.$focusOrSelecting = $Or($s.isDown, $s.hasFocus)` — used only at [:560](../apps/nodditor/src/NodeEditor.jsx#L560) to toggle one class, and as `this.$focusOrSelecting()` in the Delete/Backspace guard at [:903](../apps/nodditor/src/NodeEditor.jsx#L903) and the arrow-key nudge at [:908](../apps/nodditor/src/NodeEditor.jsx#L908) |
| `observeNow` | [NodeEditor.jsx:560](../apps/nodditor/src/NodeEditor.jsx#L560) | 1           | one reactive class toggle |

`$s` itself is not a contract member: the three booleans the editor uses live on the state proxy the
`JsxW` base class creates (see §3), so nothing here has to construct one.

Net: the entire `@jsx6/signal` dependency exists for **`min(x, y) > 0` on focus/drag state and one
class toggle**. Everything the engine needs from `$s` is:

- `$s.isDown`, `$s.isMoving`, `$s.hasFocus` — three booleans, written at
  [:681](../apps/nodditor/src/NodeEditor.jsx#L681), [:689](../apps/nodditor/src/NodeEditor.jsx#L689),
  [:694](../apps/nodditor/src/NodeEditor.jsx#L694), [:742](../apps/nodditor/src/NodeEditor.jsx#L742),
  [:746](../apps/nodditor/src/NodeEditor.jsx#L746), [:920](../apps/nodditor/src/NodeEditor.jsx#L920),
  [:921](../apps/nodditor/src/NodeEditor.jsx#L921), [:924](../apps/nodditor/src/NodeEditor.jsx#L924),
  [:926](../apps/nodditor/src/NodeEditor.jsx#L926) and read at
  [:689](../apps/nodditor/src/NodeEditor.jsx#L689), [:693](../apps/nodditor/src/NodeEditor.jsx#L693),
  [:740](../apps/nodditor/src/NodeEditor.jsx#L740), [:742](../apps/nodditor/src/NodeEditor.jsx#L742);
- `$v` — **never touched by the editor at all** (only the base class defines it; `EditableTitle`
  carries its own `getValue`/`setValue` at [EditableTitle.js:6-7](../apps/nodditor/src/EditableTitle.js#L6)).

That is a plain object plus one `updateFocusClass()` call — no signal system required.

## 3. `@jsx6/w` — `JsxW` and `define`

| Primitive | Call site                                                                         | Analysis |
| --------- | --------------------------------------------------------------------------------- | -------- |
| `JsxW`    | [NodeEditor.jsx:72](../apps/nodditor/src/NodeEditor.jsx#L72) `export class NodeEditor extends backend.current.JsxW` | **the only real coupling.** The editor gets: `$s`/`$v` state proxies, `tpl(attr)` called with the tpl options, `insert(this, …)` of the template result, `insertAttr` (which is what gives `class=`, `onclick=`, `ne-drag` etc. their meaning), `onCreate`, `handleEvent`, and the DOM mirror methods (`setAttribute`, `classList`, …). This is the piece a standalone backend must replace with something equivalent |
| `define`  | [NodeEditor.jsx:74](../apps/nodditor/src/NodeEditor.jsx#L74) (class static block) | `customElements.define(tag, ctor)` + a warn-on-redefine. Trivial, and arguably better owned locally: the current version warns and *keeps the old class* when the tag already exists, which matters if two copies of nodditor are ever loaded |

Note the interaction with the build: `JsxW`'s `insertAttr` is also what turns JSX props into DOM, so
substituting the base class means the JSX path changes with it — unless the JSX runtime is replaced
too (that binding is `jsxImportSource`, a build-time knob, not a backend primitive).

## 4. Decision matrix — what to thin, in order

Ranked by (sites × risk) ÷ payoff. Step 3 was attempted and **reverted** — it looked like a
one-liner and was not (see §1.0); steps 1–2 are mechanical; 4–7 are design decisions.

| Step | Change                                                                                      | Removes                                               | Sites      | Risk                                                                                              |
| ---- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| 1    | Local `src/dom.js` with `getAttr`/`setAttribute`/`classIf`/`isNode`/`listen`/`listenCustom`/`remove`/`runFuncNoArg`/`findParent`/`setVisible`/`fireCustom` | **11 `@jsx6/jsx6` primitives** | 34 | low — pure native equivalents; only `listenCustom` (detail unwrap) and `fireCustom` (no bubbles) need care |
| 2    | Local `src/svg.js` with `hSvg`                                                              | 1 more `@jsx6/jsx6` primitive                          | 3          | low                                                                                               |
| 3    | ~~Drop `addClass` (demo blocks write `class=` instead)~~ **REVERTED** — not equivalent       | nothing                                               | —          | **not safe**: it merges onto a props object; see §1.0                                             |
| 4    | Replace `$s` (3 booleans) + `$Or`/`observeNow` with a plain object + one callback           | `@jsx6/signal` entirely                               | 5 + 2      | medium — touch drag/focus state in the pointer handlers; fully covered by `p1/p2/p3` smoke suites |
| 5    | Own `define`; give `NodeEditor` a documented base class                                     | `@jsx6/w` (needs step 6 to be useful)                 | 2          | low for `define`, high for the base class                                                         |
| 6    | Replace `JsxW`: either (a) require the host to pass a base class, or (b) reimplement the ~60 lines the editor uses (`tpl`/`insertAttr`/`$s`) | `@jsx6/w` and the component model | structural | **high** — this is the actual architecture of the editor, and it changes how JSX props become DOM |
| 7    | Decide on `observeShowHide` (see §6)                                                        | `@jsx6/dom-observer`                                  | 1          | medium — behaviour, not plumbing                                                                  |

Applying 1–2 and 4 removes `@jsx6/jsx6` and `@jsx6/signal` — that is 18 of the 21 contract names and
roughly 96% of the measured calls, leaving `addClass`, `JsxW`, `define`, `observeShowHide`.
(`addClass` stays regardless: the blocks need the merge, and §1.0 explains why the local
`src/dom.js` version is a faithful port rather than a deletion.)

## 5. `@jsx6/dom-observer` — `observeShowHide` (one site, one feature)

- Call site: [connectorUtil.js:69](../apps/nodditor/src/connectorUtil.js#L69), storing the returned
  disposer on the connector element as `el.removeObserve`.
- Purpose: when a connector element leaves the viewport, `removeConnector` runs — the editor's
  self-healing for a host that removes block DOM without telling the editor.
- The shared-observer pool in `libs/dom-observer` exists for *many* observed elements
  (27 calls in the vanilla session, i.e. one per connector), so a naive one-`IntersectionObserver`-
  per-element replacement would regress on large graphs (the P3 smoke suite measures 200 blocks /
  801 connectors).
- Options: (a) keep and accept the dependency, (b) reimplement the shared pool (~60 lines) locally,
  (c) drop the feature and require hosts to call `removeConnector`/`removeBlock` — option (c) also
  removes the only reason `connectorMap` needs the `removeObserve` field.

## 6. What a vanilla-only nodditor would still need from jsx6

If steps 1–2 and 4–7 are taken, the answer is **nothing**: the dependency drops to zero jsx6
packages, at the cost of owning a component base class (step 6b), a faithful `addClass` merge
(§1.0), and either owning or dropping the viewport observer (step 7). If step 6 is not taken (i.e.
`JsxW` stays), the minimum is `@jsx6/w` alone — and then the JSX runtime question is separate, since
JSX → DOM is a build-time binding (`jsxImportSource`), not a runtime primitive.

The measurement that makes this tractable: in a full vanilla session the editor calls **18 of 21**
contract names, and 11 of those 18 are one-liners over DOM APIs
([smoke/essential.smoke.js](../apps/nodditor/smoke/essential.smoke.js)).

## 7. Two primitives that are deliberately OUT of scope for thinning

Recorded so the same mistake is not repeated:

- **`addClass`** — see §1.0. It was briefly replaced with a literal `class="ne-block"` in the demo
  block components, which is **not equivalent**: `addClass` merges onto a props *object's* `class`
  string, so a host-supplied class survives. The literal wins or loses by prop-application order
  (`for (let a in attr)`), and in practice loses the host's class. It is back in the contract, and
  `SEAM-6 a host class is merged, not overwritten` fails if it is removed again.
- **`provideErrTranslations`** — it is *not* in the contract, but only because nothing calls it. It
  is still the documented way to get readable jsx6 messages; a replacement backend that raises jsx6
  errors internally should install it in its own bootstrap rather than expect the editor to.

Contract size: **21 primitives**, all with a live caller (the editor, its helpers, or the block
components).

Measured now (`node smoke/essential.run.mjs`):

```
contract: 21 names — used in this session: 18, unused: 3   (JsxW, define, findParent)
```
