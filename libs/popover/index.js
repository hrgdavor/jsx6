import { observeResize } from '@jsx6/dom-observer'

export const CLICK_HIDE_ATTR = 'pop-click-hide'

/**
 * initialize a popover aligned to clicked element
 *
 * @param {*} popover - popover element that will be opened
 * @param {HTMLElement|Event} e - the html element to align the popover, or dom event where then e.target is used
 * @param {string} selector - default is 'button' and it is used to find the actual element for alingment, in case there is more markup
 * @returns
 */
export function doPop(popover, e, selector = 'button') {
  return valuePop(undefined, popover, e, selector)
}

/**
 * initialize a popover aligned to clicked element and also remember a value. Useful when
 * used in tables, to remember row data for which the menu actions will apply
 *
 * @param {*} value - value that will be set as property of provided popover (get it laterr by calling popover.value)
 * @param {*} popover - popover element that will be opened
 * @param {HTMLElement|Event} e - the html element to align the popover, or dom event where then e.target is used
 * @param {string} selector - default is 'button' and it is used to find the actual element for alingment, in case there is more markup
 * @returns
 */
export function valuePop(value, popover, e, selector = 'button') {
  let target = e.target || e
  if (selector) {
    target = target.closest(selector) || target
  }
  return showPopover(popover, target, value)
}

export function showPopover(popover, target, value) {
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
      movePopover(popover)
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
  movePopover(popover)
  popover.showPopover()
}

export function popSetVisible(pop, v) {
  if (v) {
    pop.showPopover()
  } else {
    pop.hidePopover()
  }
}

export function movePopover(pop) {
  let { width, height, target } = pop._pop
  if (!width) return

  let trect = target.getBoundingClientRect()
  let maxTop = document.body.clientHeight - height - 5
  let maxRight = document.body.clientWidth - width - 5
  pop.style.top = `${Math.min(trect.bottom, maxTop)}px`
  pop.style.left = `${Math.min(Math.max(trect.left - 10, 0), maxRight)}px`
}
