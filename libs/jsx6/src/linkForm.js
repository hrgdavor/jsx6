import { getValue } from './getValue'
import { setValue } from './setValue'

export function linkForm(comp, form) {
  comp.elements = form
  comp.setValue = v => setValue(form, v)
  comp.getValue = () => getValue(form)
}
