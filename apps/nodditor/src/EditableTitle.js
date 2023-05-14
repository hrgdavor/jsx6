import { addClass } from '@jsx6/jsx6'

import { selectElementText } from './selectElementText.js'

export const EditableTitle = (attr = {}) => {
  // @ts-ignore
  addClass(attr, 'EditableTitle')
  const getValue = () => el.textContent
  const setValue = v => (el.textContent = v)
  let el = (
    <div
      {...attr}
      onpointerup={e => {
        console.log('onpointerup', e.target.textContent, e)
        //contenteditable="true"
        e.target.setAttribute('contenteditable', 'true')
        selectElementText(e.target)
      }}
      onblur={e => {
        console.log('blur', e.target)
        e.target.removeAttribute('contenteditable')
        // setAttribute(e.target, false)
      }}
    ></div>
  )
  return Object.assign(el, { getValue, setValue })
}
