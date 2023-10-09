import { observeNow } from '@jsx6/signal'
import { setAttribute } from './setAttribute.js'
import { isArray, requireFunc } from './core.js'
import { setValueFilterSymbol, setValue } from './setValue.js'
import { getValue, getValueFilterSymbol } from './getValue.js'

export const directives = {}

export function addDirective(key, directive) {
  directives[key] = directive
}
export const getDirective = key => directives[key]

addDirective('x-if', (el, a, $signal, self) => {
  let updater = v => setAttribute(el, 'hidden', !v)
  observeNow($signal, updater)
})

addDirective('x-else', (el, a, $signal, self) => {
  let updater = v => setAttribute(el, 'hidden', !!v)
  observeNow($signal, updater)
})

addDirective('x-enabled', (el, a, $signal, self) => {
  let updater = v => setAttribute(el, 'disabled', !v)
  observeNow($signal, updater)
})

addDirective('x-disabled', (el, a, $signal, self) => {
  let updater = v => setAttribute(el, 'disabled', !!v)
  observeNow($signal, updater)
})

addDirective('x-readonly', (el, a, $signal, self) => {
  let updater = v => setAttribute(el, 'readonly', !!v)
  observeNow($signal, updater)
})

addDirective('x-value', (el, a, $signal, self) => {
  let updater = v => setValue(el, v)
  observeNow($signal, updater)
  el.addEventListener?.('input', e => $signal(getValue(el)))
})

addDirective('x-filter', (el, a, filters, self) => {
  if (isArray(filters)) {
    if (filters[0]) el[getValueFilterSymbol] = requireFunc(filters[0])
    if (filters[1]) el[setValueFilterSymbol] = requireFunc(filters[1])
  } else {
    el[getValueFilterSymbol] = requireFunc(filters)
  }
})
