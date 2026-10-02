/**
 * Runnable example: JSX, components and signal-driven DOM updates (the `@jsx6/jsx6` half of the
 * stack, with `@jsx6/signal` and `@jsx6/w`).
 *
 * The `demo` region is what `docs/stack/components.md` injects; everything outside it is the check
 * that keeps the sample honest. It needs a DOM and the JSX transform, so it runs through its runner:
 *
 *   node docs/stack/components.run.mjs
 *
 * The file is named `*.example.jsx` (not `*.test.jsx`) on purpose: it needs the DOM globals
 * registered before the modules below are evaluated, which the runner does.
 */
import assert from 'node:assert/strict'

import { addClass, addDisposer, classIf, disposeNode, insert } from '@jsx6/jsx6'
import { observeNow, signal } from '@jsx6/signal'
import { JsxW, define } from '@jsx6/w'

// #region demo
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
// #endregion demo

// ------------------------------------------------------------------------------------------------
// The demo above is deliberately small; the rest of this file pins the rules the page states.
// ------------------------------------------------------------------------------------------------

const h1 = app.querySelector('h1')
const value = app.querySelector('.counter .value')
const button = app.querySelector('.counter button')
const input = app.querySelector('input')
const paragraph = app.querySelector('p')

// A signal child updates one text node — the rest of the tree is untouched.
assert.equal(h1.textContent, 'start')
assert.equal(app.getAttribute('title'), 'start')
$title('changed')
assert.equal(h1.textContent, 'changed')
assert.equal(app.getAttribute('title'), 'changed')

// A function component's `addClass` MERGES: the host class survives.
const badge = app.querySelector('.badge')
assert.equal(badge.className, 'host badge')
assert.equal(badge.textContent, 'hi')

// The class component rendered its own markup, and its signal drives its own subtree.
assert.equal(value.textContent, '3')
button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
assert.equal(value.textContent, '4')

// `x-value` is two-way: the signal writes the input, and the input's `input` event writes back.
assert.equal(input.value, 'hello')
$text('from signal')
assert.equal(input.value, 'from signal')
input.value = 'from user'
input.dispatchEvent(new Event('input', { bubbles: true }))
assert.equal($text(), 'from user')

// `x-if` toggles the `hidden` attribute and nothing else.
assert.equal(paragraph.hasAttribute('hidden'), false)
$show(false)
assert.equal(paragraph.hasAttribute('hidden'), true)
assert.equal(paragraph.textContent, 'visible') // hidden, not removed

// A primitive that is not signal-aware is driven by hand: `observeNow` + `classIf`. The subscription
// is ours, so it only gets torn down if we hand it to `addDisposer` — everything JSX itself created
// was registered that way already.
addDisposer(
  app,
  observeNow($show, v => classIf(app, 'on', v)),
)
assert.equal(app.classList.contains('on'), false)
$show(true)
assert.equal(app.classList.contains('on'), true)

// Teardown releases every binding the subtree created: `disposeNode` never detaches, it only
// unsubscribes, and after it the DOM stops following the signals.
const released = disposeNode(app)
assert.ok(released >= 5, `expected several bindings to be released, got ${released}`)
$title('after dispose')
assert.equal(h1.textContent, 'changed') // frozen
$show(false)
assert.equal(app.classList.contains('on'), true) // frozen
assert.equal(disposeNode(app), 0) // idempotent: nothing left to release

console.log('components example: all assertions passed')