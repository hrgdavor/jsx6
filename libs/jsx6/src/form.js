// import { classIf, mapProp, setAttribute, setValue, toDomNode, isFunc } from "@jsx6/jsx6"

import { isFunc, isStr } from './core.js'
import { forEachProp } from './forEachProp.js'

export const formSymbol = Symbol.for('formSymbol')
export const formSubsetSymbol = Symbol.for('formSubsetSymbol')

// element types: formInput(leaf form element), formGroup(form itself or other subforms for nested docs)
// default group callback is before children, and we can have additional for after children

// navigate the form and d things like: setValue, setReadonly, markValidate
export function formForEach(el, meta, callback, groupCallback, validFormCheck = isValidForm) {
  if (!el) return
  // nasty trick to unwrap old components
  if (el.el instanceof HTMLElement) el = el.el

  let skip = callback?.hasOverride?.(el)
  if (!skip) {
    let form = el[formSymbol]
    if (!form && isFunc(el.getItems)) {
      let items = el.getItems()
      if (items instanceof Array) {
        form = items
      } else {
        if (validFormCheck(items)) form = items
      }
      if (form) {
        groupCallback?.(el, meta)
      }
    }

    if (!form && el instanceof HTMLElement) {
      callback(el, meta)
    } else if (!form) {
      form = ifValidFormOrFormArray(el, validFormCheck)
    }

    // if it is signal or not available as simple property
    if (form && isFunc(form)) {
      form = form()
    }
    forEachProp(form, (o, p) => {
      if (o) formForEach(o, meta?.items?.[p], callback, groupCallback, validFormCheck)
    })
  }
  // we will call setReadonly,markValidate and etc. after default callback is run
  // this allows undoing things if needed insde el.markValidate, el.setReadonly, ..etc.
  callback?.callOverride(el, meta)
}

export function ifValidFormOrFormArray(el, validFormCheck) {
  if (!el) return
  if (el instanceof Array) {
    for (let i = 0; i < el.length; i++) {
      if (!validFormCheck(el[i])) return
    }
    return el
  } else if (validFormCheck(el)) {
    return el
  }
}

export function isValidForm(el) {
  for (let p in el) {
    let item = el[p]
    if (!item) {
      console.warn('falsy value ', item, ' on form', el, 'on key ', p)
      return
    }
    if (isStr(item) || typeof item == 'number' || isFunc(item)) {
      console.warn('invalid type ', typeof item, ':', item, ' on form', el, 'on key ', p)
      return
    }
  }
  return true
}
