import { getValue } from './getValue.js'
import { setValue } from './setValue.js'

export function linkForm(comp, form) {
  comp.elements = form
  comp.setValue = v => setValue(form, v)
  comp.getValue = () => getValue(form)
}
