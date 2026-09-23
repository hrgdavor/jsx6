import { observeResize } from '@jsx6/dom-observer'

export const CLICK_HIDE_ATTR = 'pop-click-hide'

/**
 * True when the value is an element-like DOM node.
 *
 * Structural sniffing (`closest` + `nodeType`) is used instead of `instanceof Element` so
 * elements from another realm are still recognized, and - unlike `e.target || e` - an element
 * that carries its own truthy `target` property (`<a target="_blank">`, `<form target>`) is
 * detected as the element it is instead of being mistaken for an event.
 *
 * @param {*} value
 * @returns {value is Element}
 */
function isElementLike(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof value.closest === 'function' &&
    typeof value.nodeType === 'number'
  )
}

/**
 * The anchor of a popover is either the element itself or an event which carries the element
 * in `target`/`currentTarget`.
 *
 * @param {HTMLElement|Event} e - the html element to align the popover, or a dom event
 * @returns {Element|null} the anchor element, or null when the value carries none
 */
function resolveAnchor(e) {
  if (isElementLike(e)) return e
  // an event: `target` is the element the event was dispatched on
  if (isElementLike(e.target)) return e.target
  // `currentTarget` is the element the listener is registered on
  if (isElementLike(e.currentTarget)) return e.currentTarget
  return null
}

/**
 * initialize a popover aligned to clicked element
 *
 * @param {*} popover - popover element that will be opened
 * @param {HTMLElement|Event} e - the html element to align the popover, or dom event where then e.target is used
 * @param {string} selector - default is 'button' and it is used to find the actual element for alingment, in case there is more markup
 * @param {string} position - default is 'default' and it is used to position the popover relative to the anchor element topRight|topLeft|bottomRight|bottomLeft
 * @returns
 */
export function doPop(popover, e, selector = 'button', position = 'default') {
  return valuePop(undefined, popover, e, selector, position)
}

/**
 * initialize a popover aligned to clicked element and also remember a value. Useful when
 * used in tables, to remember row data for which the menu actions will apply
 *
 * @param {*} value - value that will be set as property of provided popover (get it laterr by calling popover.value)
 * @param {*} popover - popover element that will be opened
 * @param {HTMLElement|Event} e - the html element to align the popover, or dom event where then e.target is used
 * @param {string} selector - default is 'button' and it is used to find the actual element for alingment, in case there is more markup
 * @param {string} position - default is 'default' and it is used to position the popover relative to the anchor element topRight|topLeft|bottomRight|bottomLeft
 * @returns
 */
export function valuePop(value, popover, e, selector = 'button', position = 'default') {
  // `e` is either the anchor element itself or an event which carries the anchor in `target`
  let target = resolveAnchor(e)
  if (selector && target) {
    target = target.closest(selector) || target
  }
  return showPopover(popover, target, value, position)
}

export function showPopover(popover, target, value, position) {
  if (!target) throw new Error('target required')
  if (!popover._pop) {
    let _pop = (popover._pop = { width: 0, height: 0 })
    if (!popover.hasAttribute(CLICK_HIDE_ATTR)) popover.setAttribute(CLICK_HIDE_ATTR, '')
    observeResize(popover, e => {
      if (!e.contentRect.width) return
      // we need outside dimensions, contentRect is not sufficient
      if (e.borderBoxSize?.length) {
        let rect = e.borderBoxSize[0]
        _pop.width = rect.inlineSize
        _pop.height = rect.blockSize
      } else {
        let rect = popover.getBoundingClientRect()
        _pop.width = rect.width
        _pop.height = rect.height
      }
      movePopover(popover, position)
    })
    popover.onclick = e => {
      let p = e.target.closest(`[${CLICK_HIDE_ATTR}]`)
      let val = p ? p.getAttribute(CLICK_HIDE_ATTR) : null
      if (val == 'false') return
      if (val == 'children' && p === e.target) return
      popover.hidePopover()
    }
  }

  popover._pop.target = target
  popover.value = value
  movePopover(popover, position)
  popover.showPopover()
}

export function popSetVisible(pop, v) {
  if (v) {
    pop.showPopover()
  } else {
    pop.hidePopover()
  }
}

export function movePopover(pop, position = 'default', offset = 6) {
  let { width, height, target } = pop._pop
  if (!width) return

  const trect = target.getBoundingClientRect()
  const maxTop = document.body.clientHeight - height - 5
  const maxRight = document.body.clientWidth - width - 5

  let top, left

  switch (position) {
    case 'topLeft':
      top = Math.max(trect.top - height - offset, 0)
      left = Math.max(trect.left, 0)
      break

    case 'topRight':
      top = Math.max(trect.top - height - offset, 0)
      left = Math.min(trect.right - width, maxRight)
      break

    case 'bottomLeft':
      top = Math.min(trect.bottom + offset, maxTop)
      left = Math.max(trect.left, 0)
      break

    case 'bottomRight':
      top = Math.min(trect.bottom + offset, maxTop)
      left = Math.min(trect.right - width, maxRight)
      break

    default:
      top = Math.min(trect.bottom + offset, maxTop)
      left = Math.min(Math.max(trect.left - 10, 0), maxRight)
      break
  }

  pop.style.top = `${top}px`
  pop.style.left = `${left}px`
}
