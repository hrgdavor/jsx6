# Components and the DOM

`@jsx6/jsx6` does not hide the DOM — JSX creates it. The runtime is nine lines
([libs/jsx-runtime/index.js](../../libs/jsx-runtime/index.js)):

```js
function jsx(tag, { children, ...attr }) {
  if (tag === Fragment) return children
  return toDom(tag, attr, children)
}
```

So `<section class="app" title={$title}>` is a call to `toDom('section', { class: 'app', title: $title }, …)`,
which creates the element, walks the attributes, and inserts the children. Everything reactive is a
binding created at that moment, on the exact node, attribute or text node it belongs to.

[components.example.jsx](./components.example.jsx#region:demo)

```jsx
// A component is either a function that returns DOM, or a class extending JsxW. A function component
// receives the props object, and whatever it returns is what gets inserted:
function Badge(attr) {
  addClass(attr, 'badge') // merges into attr.class instead of replacing it
  return <span {...attr}>{attr.label}</span>
}

// A JsxW subclass is a real element: `tpl()` returns its markup, and the component owns its signals.
class Counter extends JsxW {
  static {
    define('x-counter', this) // registers the tag for HTML use; JSX instantiates the class directly
  }
  tpl(attr) {
    super.tpl(attr) // applies the host attributes and children this instance was given
    const $count = signal(Number(attr.start ?? 0))
    this.$count = $count
    return (
      <div class="counter">
        <button onclick={() => $count($count() + 1)}>+1</button>
        <b class="value">{$count}</b>
      </div>
    )
  }
}

// In JSX a signal can be a child (reactive text) or an attribute value (reactive attribute), and the
// x- directives turn one into an enabled/visible/value binding.
const $title = signal('start')
const $show = signal(true)
const $text = signal('hello')

const app = (
  <section class="app" title={$title}>
    <h1>{$title}</h1>
    <Badge class="host" label="hi" />
    <Counter start="3" />
    <input x-value={$text} />
    <p x-if={$show}>visible</p>
  </section>
)

insert(document.body, app)
```

Run it: `node docs/stack/components.run.mjs`.

## Two kinds of component

**A function component** receives the props object and returns DOM. It is a plain function; the editor
and the framework see one value:

```jsx
function Badge(attr) {
  addClass(attr, 'badge') // merges into attr.class — the host class survives
  return <span {...attr}>{attr.label}</span>
}
```

`addClass(propsObject, 'x')` is the merge idiom: given a props object it appends to its `class` string
instead of replacing it, so `class="host"` becomes `class="host badge"`.

**A class component extends `JsxW`** from `@jsx6/w`, which is a real `HTMLElement`:

```jsx
class Counter extends JsxW {
  static {
    define('x-counter', this) // registers the tag for HTML use; JSX works without it
  }
  tpl(attr, children) {
    super.tpl(attr, children) // applies the attributes/children this instance was given
    return <div>…</div>
  }
}
```

* `tpl` is evaluated inside `domWithScope(this, …)`, so `p="field"` attributes land on the component and
  event handlers are bound to it.
* The component owns `$s` (a `$State` for its own state) and `$v` (a `$State` for its value), and
  `getValue()`/`setValue()`/`mergeValue()`/`mergeState()` go through them — that is what `linkForm` and
  the form helpers integrate with.
* `onCreate()` runs once, after the content is inserted. `JsxW` has **no** destroy hook: node teardown is
  `disposeNode` (below), not a lifecycle method.
* `JsxWS` is the same class with a shadow root attached by default.

## The attribute contract

`insertAttr` decides what an attribute means, in this order:

| attribute | meaning |
| --- | --- |
| `on…` | an event listener: `onclick`, `onkeydown`, and custom events by their dashed name — `onne-move-done` listens for `ne-move-done`. The name after `on` is lower-cased, so `onClick` also works; the repository convention is all-lowercase |
| `class` | the literal `class` attribute (there is no `className` normalisation anywhere) |
| `key` | a loop key: stored on the node as `loopKey`/`$key` **and** written as a `key` attribute |
| `x-…` | a directive (table below); an unregistered `x-foo` falls through and becomes a literal attribute |
| `p` | put this element on the component's scope: `p="form.name"` → `scope.form.name`; `p={$signal}` writes the element into the signal |
| anything else | `setAttribute` — unless the value is a **function**, which makes it a live binding |
| `oncreate` | special: removed before processing, then called with `(element, scope)` after the element exists (a function or an array of them) |

**A function-valued attribute is a subscription.** `<span title={$title}>` re-evaluates `$title()` and
writes the attribute on every change. That is the whole reactive-attribute mechanism — do not pass a
function you did not mean to subscribe.

### Directives

| directive | effect |
| --- | --- |
| `x-if={$cond}` | `hidden` = `!value` — the element stays in the DOM |
| `x-else={$cond}` | the inverse |
| `x-enabled={$ok}` | `disabled` = `!value` |
| `x-disabled={$bad}` | `disabled` = `!!value` |
| `x-readonly={$ro}` | `readonly` = `!!value` |
| `x-value={$text}` | **two-way** binding: the signal writes the element's value, and the element's `input` event writes back into the signal |
| `x-filter={fn}` or `x-filter={[getFn, setFn]}` | attach value filters used by `getValue`/`setValue` |

Register your own with `addDirective(name, (el, attrName, value, scope) => …)`; the directive runs while
the element is being built and is responsible for its own teardown.

## How signal values reach the DOM

Four mechanisms, in the order you will meet them:

1. **A child that is a function** — `{$count}`: one text node is created as an anchor and bound; the
   update rewrites that text node (or swaps in a node/array, if the function returns one).
2. **An attribute that is a function** — `title={$title}`.
3. **A directive** — `x-if`, `x-value`, …
4. **By hand** — `observeNow($sig, updater)` for anything the primitives do not cover, e.g. a class:

```js
import { classIf } from '@jsx6/jsx6'
import { observeNow } from '@jsx6/signal'

addDisposer(app, observeNow($focus, f => classIf(app, 'focused', f)))
```

`classIf`, `setVisible`/`isVisible` and `setValue` are **not** signal-aware: they take values. Pass a
signal where a value is expected and a function is truthy, so the effect is frozen "on".

Note also that `setValue($signal, v)` does **not** write the signal: a function argument is *read*, so it
writes into the value the signal currently holds. Use `$signal(v)`.

DOM writes are synchronous — one signal write updates its bindings before it returns.
`@jsx6/signal-dom` offers batched helpers (`runInBatch`, `signal2Attribute`, `signal2Text`); the JSX
engine does not use them, and `setAttribute` itself is the same implementation.

## Lists: `Loop`

There are two `Loop` implementations in the stack, and they are not equivalent:

| | [`@jsx6/jsx6` Loop](../../libs/jsx6/src/Loop.js) | [`@jsx6/w` Loop](../../libs/w/src/Loop.js) |
| --- | --- | --- |
| shape | a plain class whose `.el` is a text-node anchor | the custom element `<jsx6-loop>` |
| reconciliation | **key first, then previous index** — `key={item.id}` moves the existing item instance, so its state and bindings survive; without keys it reuses by index | index-only |
| initial data | applied on a `setTimeout(…, 0)`, so the first value is not in the DOM synchronously | observed synchronously |

If you need keyed reconciliation today, use `Loop` from `@jsx6/jsx6` and declare the key
(`<b key={item.id}>`). The keyed/unkeyed difference and the open work on the `@jsx6/w` copy are tracked in
[plan/keyed-loop-design.md](../../plan/keyed-loop-design.md).

## Teardown: every binding is registered

While a node is built, every subscription it creates is pushed onto the node itself: signal-valued
attributes, `on*` listeners, the child text anchor, all directives and their listeners. `disposeNode(node)`
walks the subtree and releases them:

* **post-order** (children first), **idempotent**, **never throws**, and it **never detaches** — removing
  nodes stays `remove()`, `replace()` or native DOM calls;
* `remove()` disposes before detaching, and `replace()`/`replaceContent()` dispose what they take out;
* subscriptions **you** create are not automatic: hand the unsubscribe to `addDisposer(node, unsub)` (or
  the node's own `dispose()`) or it will outlive the DOM.

The container contract is small: any object with an `.el` is treated as a wrapper around that element,
and arrays are walked. A component can also implement `ondestroy()` (the `Jsx6` base class does) — it runs
once, after the subtree's bindings are gone.

## Forms, validation and i18n

These live in the same package and integrate through `getValue`/`setValue`:

| area | entry points |
| --- | --- |
| form wiring | `linkForm(component, formObject)`, `form`, `formForEach`, `isValidForm` |
| validation | `validate(value, rule, field)` (async), `requiredRule`, `intRule`, `floatRule`, `isAllValid` |
| translations | `addTranslations`, `t`, `T` (a duck-typed signal), `$T` (a derived signal), `errTranslations` / `provideErrTranslations()` for the built-in `JSX6E*` messages |

`linkForm` makes a component read and write an external object instead of its internal `$v`; the walkers
(`formForEach`) recurse through nested forms and loops and are the hook a project uses to render
validation state. The full API map is [docs/api.md](../api.md).

## Verifying a change here

```sh
node docs/stack/components.run.mjs                 # this page's example
bun test                                           # the jsx6/w suites, from the repository root
bun x tsc --noEmit -p libs/jsx6/tsconfig.json      # JSDoc type check
```

The rule of thumb for this layer: if a DOM change is not happening, check whether the binding was created
at build time (a value passed instead of a signal, or a signal passed where a value is expected), and
whether the node is still connected (`disposeNode` freezes bindings by design).