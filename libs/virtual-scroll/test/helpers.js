export const DUMMY_ITEMS_CONTAINER = { appendChild: () => {} }

/**
 * A container that records what was appended to it. `VirtualScroll` only ever calls `appendChild`,
 * so this is enough to assert the pool invariant without a DOM (and without happy-dom's missing
 * layout: `getBoundingClientRect()` is `{0,0,0,0}` there, so positions can only be checked through
 * the transform the library writes).
 */
export function stubContainer() {
  const appended = []
  return {
    appended,
    appendChild(el) {
      appended.push(el)
      el.parentNode = this
    },
  }
}

/** The class `hiddenClass` mode is tested with. */
export const POOLED_CLASS = 'vs-pooled'

/**
 * A row stub with just what `VirtualScroll` touches: `style`, `classList`, `parentNode` and
 * `remove()`.
 */
export function stubRow() {
  const classes = new Set()
  return {
    style: {},
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      contains: name => classes.has(name),
    },
    parentNode: null,
    removed: false,
    remove() {
      this.removed = true
      this.parentNode = null
    },
  }
}

/** Every element handed to the container must be mounted or recycled — never orphaned. */
export function orphans({ vs, container }) {
  const accounted = new Set([...vs.idDomMap.values(), ...vs.unusedPool])
  return container.appended.filter(el => !accounted.has(el))
}

/**
 * Hidden either of the two ways the library can hide a row: the default inline `display: none`, or
 * the `hiddenClass` a host opted into instead (whose CSS decides the mechanism).
 */
export const isHidden = (el, hiddenClass = POOLED_CLASS) =>
  el.classList.contains(hiddenClass) || el.style.display === 'none'

/** A row that has been handed back to the visible list. */
export const isShown = (el, hiddenClass = POOLED_CLASS) => !isHidden(el, hiddenClass)

/** A visible row that the instance no longer tracks would stay on screen forever. */
export function visibleUntracked({ vs, container }) {
  const tracked = new Set(vs.idDomMap.values())
  return container.appended.filter(el => isShown(el) && !tracked.has(el))
}

expect.extend({
  // better to test translation
  toBeAtPosition(element, expectedPosition) {
    const actualPosition = element.__vsIndex

    return {
      pass: actualPosition == expectedPosition,
      message: () => `expected id to be ${expectedPosition} but got ${actualPosition}`,
    }
  },
})

// updated X times
expect.extend({
  wasUpdated(element, expected) {
    return {
      pass: expected == element.updateCount,
      message: () => `expected element to have been updated ${expected} times but got ${element.updateCount}`,
    }
  },
})

// innerHTML
