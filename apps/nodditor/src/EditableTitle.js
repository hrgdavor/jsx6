import { addClass, fireCustom } from '@jsx6/jsx6'

import { selectElementText } from './selectElementText.js'

export const EditableTitle = (attr = {}) => {
  // @ts-ignore
  addClass(attr, 'EditableTitle')
  const getValue = () => el.textContent
  const setValue = v => (el.textContent = v)
  let old
  const commit = () => {
    el.removeAttribute('contenteditable')
    let value = el.textContent
    if (value != old) {
      fireCustom(el, 'change', { value })
    }
  }
  let el = (
    <div
      {...attr}
      onpointerup={e => {
        if (e.ctrlKey || e.shiftKey || e.altKey) return
        old = el.textContent
        el.setAttribute('contenteditable', 'true')
        selectElementText(el)
        el.focus()
      }}
      onkeydown={e => {
        if (!el.isContentEditable) return
        if (e.key === 'Enter') {
          commit()
          e.preventDefault()
        } else if (e.key === 'Escape') {
          el.textContent = old
          el.removeAttribute('contenteditable')
          e.preventDefault()
        }
      }}
      onblur={e => {
        if (el.isContentEditable) commit()
      }}
    ></div>
  )
  return Object.assign(el, { getValue, setValue })
}
