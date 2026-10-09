/**
 * `JsxW`'s construction contract: a custom element's constructor must not add attributes or children, so
 * the template is built at the first moment that is legal — on `connectedCallback` for an element that is
 * created detached, and in the constructor only when the element is already connected.
 *
 * This is the regression guard for a real defect: building in the constructor unconditionally made
 * `document.createElement('some-component')` throw
 * `NotSupportedError: The result must not have attributes` and leave the element **un-upgraded**, so a
 * host that loads the library (rather than having its element parsed from HTML before the class is
 * registered) got an element with none of its class's methods. Measured in `apps/nodditor`'s host before
 * the fix; `NodeEditor` already chained `super.connectedCallback?.()`, so the deferred path is the one to
 * test here.
 *
 * Two things this file deliberately does **not** assert, both learned by writing it:
 *
 * - that a detached `tpl` sees attributes set on the element via `setAttribute` before insertion — that
 *   was never `JsxW`'s contract (`tpl` receives the attribute object its creator passed in, and
 *   `insertAttr` is the JSX path's job);
 * - that a JSX-created element is connected before it is inserted — **it is not** in this environment, so
 *   its content arrives on insertion like any other detached element.
 */
import { JsxW, define } from '../index.js'

/** Marks the element from inside `tpl`, so "did the build run" is observable without the template. */
class Probe extends JsxW {
  static {
    define('jsx6-probe-w', this)
  }

  tpl(attr) {
    super.tpl(attr)
    this.built = true
    return <div class="probe">built</div>
  }
}

test('a component created with createElement upgrades and builds on connect, not in the constructor', () => {
  // This is the exact call that threw `NotSupportedError: The result must not have attributes` before the
  // fix, and it left the element without its class's methods.
  const element = document.createElement('jsx6-probe-w')

  expect(element instanceof Probe).toEqual(true)
  expect(element.innerHTML).toEqual('')
  expect(element.built).toEqual(undefined)

  document.body.appendChild(element)

  expect(element.built).toEqual(true)
  expect(element.querySelector('.probe')).not.toEqual(null)
  expect(element.querySelector('.probe').textContent).toEqual('built')
  element.remove()
})

test('a JSX-created element builds on insertion too', () => {
  const element = <Probe />
  expect(element instanceof Probe).toEqual(true)

  document.body.appendChild(element)

  expect(element.built).toEqual(true)
  expect(element.querySelector('.probe').textContent).toEqual('built')
  element.remove()
})

test('the build is idempotent across remove and re-insert', () => {
  const element = document.createElement('jsx6-probe-w')
  document.body.appendChild(element)
  const first = element.querySelector('.probe')
  expect(first.textContent).toEqual('built')

  element.remove()
  document.body.appendChild(element)

  expect(element.querySelector('.probe')).toEqual(first)
  expect(element.querySelectorAll('.probe').length).toEqual(1)
  element.remove()
})

test('a subclass may chain its own connectedCallback work after the build', () => {
  // `apps/nodditor`'s NodeEditor does exactly this — `super.connectedCallback?.()` then a connector
  // rescan — so the ordering this fix establishes is the one a real subclass depends on.
  const seen = []
  class Chained extends JsxW {
    static {
      define('jsx6-probe-chain', this)
    }

    tpl(attr) {
      super.tpl(attr)
      seen.push('tpl')
      return <b>x</b>
    }

    connectedCallback() {
      super.connectedCallback?.()
      seen.push(this.innerHTML === '<b>x</b>' ? 'connected:after-build' : 'connected:before-build')
    }
  }

  const element = document.createElement('jsx6-probe-chain')
  document.body.appendChild(element)

  expect(seen).toEqual(['tpl', 'connected:after-build'])
  expect(element instanceof Chained).toEqual(true)
  element.remove()
})

test('a direct construction with no attribute object still hands tpl an object', () => {
  // `JSDoc` says `tpl` receives "attributes and properties passed to the component", and the JSX runtime
  // always passes a real object — but `super.tpl(attr)`/`insertAttr(attr, …)` and a destructuring signature
  // both assume one, so a direct `new X()` must not hand `undefined` to `tpl`.
  //
  // `new Bare()` is the only path that exercises the difference, so this uses a direct construction rather
  // than JSX. It is also the test that keeps the `attr || {}` guard alive across the deferral: it is applied
  // where the pending object is created, and an implementation that dropped it entirely fails here.
  let received = 'never-called'

  class Bare extends JsxW {
    static {
      define('jsx6-probe-bare', this)
    }

    tpl(attr) {
      received = attr
      super.tpl(attr)
      return <i>bare</i>
    }
  }

  const element = new Bare()
  expect(received).toEqual('never-called') // the build waits for connect

  document.body.appendChild(element)

  expect(received).toEqual({})
  expect(element.innerHTML).toEqual('<i>bare</i>')
  expect(element instanceof Bare).toEqual(true)
  element.remove()
})
