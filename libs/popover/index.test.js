import { expect, test, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

// `@jsx6/dom-observer` creates its shared `ResizeObserver` when it is imported, so the DOM
// globals must be registered before the popover module is loaded (hence the dynamic import).
GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

const { CLICK_HIDE_ATTR, doPop, movePopover, valuePop } = await import('./index.js')

/**
 * A popover element with the native popover API stubbed out: happy-dom 14 has no
 * `showPopover`/`hidePopover`, and this test is only about anchor resolution.
 *
 * @returns {HTMLElement & { shown: boolean }}
 */
function makePopover() {
  const pop = /** @type {HTMLElement & { shown: boolean }} */ (document.createElement('div'))
  pop.shown = false
  pop.showPopover = () => {
    pop.shown = true
  }
  pop.hidePopover = () => {
    pop.shown = false
  }
  return pop
}

// The anchor used to be resolved with `e.target || e`, which reads the `target` *attribute* of
// an element passed directly (`<a target="_blank">`, `<form target>`) as if it were an event
// target: `target` became the string `_blank` and the following `.closest()` call threw.
test('an event anchor resolves to the clicked element', () => {
  const anchor = document.createElement('div')
  anchor.innerHTML = '<button>x</button>'
  const button = /** @type {HTMLElement} */ (anchor.firstElementChild)
  const pop = makePopover()

  doPop(pop, { target: button })

  expect(pop._pop.target).toBe(button)
  expect(pop.shown).toBe(true)
})

test('an element with its own target attribute is not treated as an event', () => {
  const link = document.createElement('a')
  link.setAttribute('href', '#')
  link.setAttribute('target', '_blank')
  const pop = makePopover()

  doPop(pop, link)

  expect(pop._pop.target).toBe(link)
  expect(pop._pop.target.getAttribute('target')).toBe('_blank')
  expect(pop.shown).toBe(true)
})

test('a direct element with a target attribute still resolves the selector around it', () => {
  const button = document.createElement('button')
  button.innerHTML = '<a target="_blank">open</a>'
  const link = /** @type {HTMLElement} */ (button.firstElementChild)
  const pop = makePopover()

  doPop(pop, link)

  expect(pop._pop.target).toBe(button)
  expect(link.getAttribute('target')).toBe('_blank')
})

test('valuePop keeps the value and a custom selector', () => {
  const row = document.createElement('div')
  row.innerHTML = '<span class="cell">cell</span>'
  const cell = /** @type {HTMLElement} */ (row.firstElementChild)
  const pop = makePopover()

  valuePop({ id: 7 }, pop, { target: cell }, '.cell')

  expect(pop._pop.target).toBe(cell)
  expect(pop.value).toEqual({ id: 7 })
  expect(pop.getAttribute(CLICK_HIDE_ATTR)).toBe('')
})

test('movePopover positions the popover below the anchor', () => {
  // happy-dom has no layout, so the viewport the module clamps against is stubbed
  Object.defineProperty(document.body, 'clientHeight', { value: 800, configurable: true })
  Object.defineProperty(document.body, 'clientWidth', { value: 600, configurable: true })
  const anchor = document.createElement('div')
  anchor.getBoundingClientRect = () => /** @type {DOMRect} */ ({ bottom: 100, top: 80, left: 20, right: 60 })
  const pop = makePopover()

  doPop(pop, anchor)
  pop._pop.width = 50
  pop._pop.height = 20
  movePopover(pop)

  expect(pop.style.top).toBe('106px')
  expect(pop.style.left).toBe('10px')
})

test('a value without any element throws instead of calling closest on a string', () => {
  const pop = makePopover()
  expect(() => doPop(pop, { target: null })).toThrow('target required')
})
