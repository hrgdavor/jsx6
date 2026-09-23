import { afterAll, expect, test } from 'bun:test'

import { GlobalRegistrator } from '@happy-dom/global-registrator'

import { callAnim, runDirty, runInBatch, setAnimFunction } from './makeState.js'
import { setAttribute } from './setAttribute.js'

GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

// P3-1: setAttribute and the batching helpers now live in @jsx6/signal-dom and are re-exported
// from jsx6. These assertions guard the re-export itself, including the component-wrapper form
// that signal-dom's own copy did not support.
test('setAttribute sets, removes and coerces values', () => {
  const el = document.createElement('div')

  setAttribute(el, 'data-x', 'value')
  expect(el.getAttribute('data-x')).toBe('value')

  setAttribute(el, 'data-x', null)
  expect(el.hasAttribute('data-x')).toBe(false)

  setAttribute(el, 'data-x', undefined)
  expect(el.hasAttribute('data-x')).toBe(false)

  setAttribute(el, 'data-x', false)
  expect(el.hasAttribute('data-x')).toBe(false)

  setAttribute(el, 'data-x', true)
  expect(el.getAttribute('data-x')).toBe('data-x')
})

test('setAttribute accepts a component/object wrapper exposing the node on .el', () => {
  const el = document.createElement('div')
  const wrapper = { el }

  setAttribute(wrapper, 'data-wrapped', 'w')
  expect(el.getAttribute('data-wrapped')).toBe('w')
})

test('batching is re-exported and runs queued callbacks', () => {
  expect(typeof setAnimFunction).toBe('function')
  expect(typeof callAnim).toBe('function')
  expect(typeof runDirty).toBe('function')

  // Drive the batch synchronously instead of waiting for an animation frame.
  const frames = []
  setAnimFunction(cb => frames.push(cb))

  let calls = 0
  runInBatch(() => calls++)
  expect(calls).toBe(0) // queued, not run yet
  expect(frames.length).toBe(1)
  frames[0]()
  expect(calls).toBe(1)
})

test('runInBatch rejects a non-function callback', () => {
  expect(() => runInBatch('not a function')).toThrow('JSX6E7')
})