/**
 * Browser-only smoke test — implementation of plan/improvement-plan.md §2.4.
 *
 * happy-dom tolerates detached WebIDL methods, so `anim = window.requestAnimationFrame` followed
 * by `anim(cb)` passes every other test in this repo and then throws `Illegal invocation` in
 * Chrome/Firefox/Safari. This file installs a strict `window` guard that restores browser
 * semantics (a WebIDL method called with the wrong receiver throws), and then exercises the
 * paths that would silently break in a real browser:
 *
 *   1. the guard itself (a detached call must throw);
 *   2. batching via `runInBatch` from makeState.js;
 *   3. mounting a Loop, reordering it and removing from the middle — DOM order plus no
 *      console errors;
 *   4. `remove()` on a parentless node logs exactly one line and never dumps the window graph.
 */
import { afterAll, expect, test } from 'bun:test'

import { GlobalRegistrator } from '@happy-dom/global-registrator'

globalThis.oldConsole = console
GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

/**
 * Methods that browsers implement as WebIDL operations on the window: calling them detached from
 * `window` throws "Illegal invocation". happy-dom implements them as plain functions, so wrap
 * them to behave like a browser. `setTimeout` is deliberately not guarded: browsers allow a
 * detached `setTimeout` call, and the test harness itself relies on that.
 */
const WEBIDL_METHODS = ['requestAnimationFrame', 'cancelAnimationFrame']

const strictWindow = win => {
  for (const name of WEBIDL_METHODS) {
    const original = win[name]
    if (typeof original !== 'function') continue
    /** @type {any} */
    const guarded = function (...args) {
      // A bare `raf(cb)` call has `this === undefined`, which is exactly the detached case
      // that throws in Chrome/Firefox/Safari.
      if (this !== win) {
        throw new TypeError(`Illegal invocation: ${name} called with the wrong receiver`)
      }
      return original.apply(win, args)
    }
    win[name] = guarded
  }
}

// Must happen before the modules under test are loaded, because makeState.js captures the
// animation-frame function when it is imported.
strictWindow(window)

const flushFrames = () => new Promise(resolve => setTimeout(resolve, 20))

test('the strict window guard catches detached WebIDL calls', () => {
  const raf = window.requestAnimationFrame
  expect(() => raf(() => {})).toThrow(TypeError)
  expect(() => window.requestAnimationFrame(() => {})).not.toThrow()
})

test('runInBatch schedules through an attached window function', async () => {
  const { runInBatch } = await import('./makeState.js')
  let calls = 0
  runInBatch(() => calls++)
  // The batch is scheduled on the animation frame; happy-dom drives rAF asynchronously.
  await flushFrames()
  expect(calls).toBe(1)
})

test('Loop mounts, reorders and removes items with correct DOM order and no console errors', async () => {
  const { domWithScope, h } = await import('./jsx2dom.js')
  const { Loop } = await import('./Loop.js')

  const errors = []
  const realError = console.error
  console.error = (...args) => {
    errors.push(args.map(a => String(a)).join(' '))
  }

  try {
    const scope = {}
    const Item = ({ value }) => h('B', null, value.x)
    const div = domWithScope(scope, hFn => hFn('DIV', null, hFn(Loop, { item: Item, p: 'loop' }), 'test'))
    document.body.appendChild(div)
    const loop = scope.loop

    loop.setValue([{ x: 1 }, { x: 2 }, { x: 3 }])
    expect(div.innerHTML).toEqual('<b>1</b><b>2</b><b>3</b>test')

    // moveItem(fromIndex, insertBefore) inserts before the item that sits at `insertBefore`
    // in the *original* order: moving item 0 before item 2 leaves [2, 1, 3].
    loop.moveItem(0, 2)
    expect(div.innerHTML).toEqual('<b>2</b><b>1</b><b>3</b>test')

    // Move it to the front instead.
    const loop2 = (() => {
      const scope2 = {}
      const div2 = domWithScope(scope2, hFn => hFn('DIV', null, hFn(Loop, { item: Item, p: 'loop' }), 'test'))
      document.body.appendChild(div2)
      scope2.loop.setValue([{ x: 1 }, { x: 2 }, { x: 3 }])
      scope2.loop.moveItem(2, 0)
      expect(div2.innerHTML).toEqual('<b>3</b><b>1</b><b>2</b>test')
      div2.remove()
      return scope2.loop
    })()
    expect(loop2.size()).toBe(3)

    // Remove from the middle: the remaining siblings must keep their order.
    loop.splice(1, 1)
    expect(div.innerHTML).toEqual('<b>2</b><b>3</b>test')

    // Append again to prove the removed node is reused rather than lost.
    loop.splice(2, 0, { x: 9 })
    expect(div.innerHTML).toEqual('<b>2</b><b>3</b><b>9</b>test')

    // Shrinking detaches items that must be available for reuse.
    loop.setValue([{ x: 7 }])
    expect(div.innerHTML).toEqual('<b>7</b>test')
    loop.setValue([{ x: 7 }, { x: 8 }])
    expect(div.innerHTML).toEqual('<b>7</b><b>8</b>test')

    div.remove()
  } finally {
    console.error = realError
  }

  expect(errors).toEqual([])
})

test('remove() of a parentless node logs a single line instead of the window graph', async () => {
  const { remove } = await import('./remove.js')

  const messages = []
  const realError = console.error
  console.error = (...args) => {
    messages.push(args)
  }

  try {
    const orphan = document.createElement('div')
    expect(() => remove(orphan)).toThrow()
  } finally {
    console.error = realError
  }

  expect(messages.length).toBe(1)
  expect(messages[0].length).toBe(1)
  const [message] = messages[0]
  expect(typeof message).toBe('string')
  expect(message).toContain('failed to remove child')
  // The whole window/document graph must not end up in the log.
  expect(message.length).toBeLessThan(200)
})