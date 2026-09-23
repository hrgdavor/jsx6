import { observeNow } from '@jsx6/signal'
import { setAttribute } from './setAttribute.js'
import { isArray, requireFunc } from './core.js'
import { setValueFilterSymbol, setValue } from './setValue.js'
import { getValue, getValueFilterSymbol } from './getValue.js'
import { addDisposer } from './dispose.js'

export const directives = {}

export function addDirective(key, directive) {
  directives[key] = directive
}
export const getDirective = key => directives[key]

addDirective('x-if', (el, a, $signal, self) => {
  let updater = v => setAttribute(el, 'hidden', !v)
  addDisposer(el, observeNow($signal, updater))
})

addDirective('x-else', (el, a, $signal, self) => {
  let updater = v => setAttribute(el, 'hidden', !!v)
  addDisposer(el, observeNow($signal, updater))
})

addDirective('x-enabled', (el, a, $signal, self) => {
  let updater = v => setAttribute(el, 'disabled', !v)
  addDisposer(el, observeNow($signal, updater))
})

addDirective('x-disabled', (el, a, $signal, self) => {
  let updater = v => setAttribute(el, 'disabled', !!v)
  addDisposer(el, observeNow($signal, updater))
})

addDirective('x-readonly', (el, a, $signal, self) => {
  let updater = v => setAttribute(el, 'readonly', !!v)
  addDisposer(el, observeNow($signal, updater))
})

addDirective('x-value', (el, a, $signal, self) => {
  let updater = v => setValue(el, v)
  addDisposer(el, observeNow($signal, updater))
  const onInput = e => $signal(getValue(el))
  el.addEventListener?.('input', onInput)
  // the listener writes back into the signal, so it must go away with the node
  addDisposer(el, () => el.removeEventListener?.('input', onInput))
})

addDirective('x-filter', (el, a, filters, self) => {
  if (isArray(filters)) {
    if (filters[0]) el[getValueFilterSymbol] = requireFunc(filters[0])
    if (filters[1]) el[setValueFilterSymbol] = requireFunc(filters[1])
  } else {
    el[getValueFilterSymbol] = requireFunc(filters)
  }
})
