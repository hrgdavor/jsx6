import { observeIntersect } from '@jsx6/dom-observer'
import { Jsx6, addToBody, makeState, provideErrTranslations } from '@jsx6/jsx6'

import './intersect.css'
import './main.css'

const percent = v => (v * 100).toFixed(0)
provideErrTranslations()
let seq = 1
const TestIntersect = ({}) => {
  const $s = makeState({ intersectionRatio: 0, isVisible: undefined })
  const idx = seq++
  const ratio = $s.intersectionRatio(percent)
  const out = (
    <div class="TestIntersect">
      <b>{ratio}</b>
      <b>{ratio}</b>
    </div>
  )
  observeIntersect(
    out,
    evt => {
      console.log(idx, 'intersect', evt.intersectionRatio)
      $s.intersectionRatio = evt.intersectionRatio
      $s.isVisible = evt.isVisible
    },
    { detail: 0.01 },
  )
  return out
}

addToBody(
  <div style="" class="owa IntesectOuter">
    <TestIntersect />
    <TestIntersect />
    <TestIntersect />
  </div>,
)
