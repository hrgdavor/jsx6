import { addClass, fireCustom } from '@jsx6/jsx6'

import { selectElementText } from './selectElementText.js'

export const EditableTitle = (attr = {}) => {
  // @ts-ignore
  addClass(attr, 'EditableTitle')
  const getValue = () => el.textContent
  const setValue = v => (el.textContent = v)
  let old
  let el = (
    <div
      {...attr}
      onpointerup={e => {
        if (e.ctrlKey || e.shiftKey || e.altKey) return
        old = el.textContent
        el.setAttribute('contenteditable', 'true')
        selectElementText(el)
      }}
      onblur={e => {
        el.removeAttribute('contenteditable')
        let value = el.textContent
        if (value != old) {
          fireCustom(el, 'change', { value })
        }
      }}
    ></div>
  )
  return Object.assign(el, { getValue, setValue })
}
