import { observeIntersect } from '@jsx6/dom-observer'
import { Jsx6, addToBody, makeState, provideErrTranslations } from '@jsx6/jsx6'

import './intersect.css'
import './main.css'

const percent = v => (v * 100).toFixed(0)
const percentStr = v => (v * 100).toFixed(0) + '%'
provideErrTranslations()
let seq = 1
let intersectStates = makeState({ box1: 0, box2: 0, box3: 0 })

const TestIntersect = ({}) => {
  const $s = makeState({ intersectionRatio: 0, isVisible: undefined })
  const idx = seq++
  const ratio = $s.intersectionRatio(percentStr)
  const out = (
    <div class="TestIntersect">
      <b>{ratio}</b>
      <div>{idx}</div>
      <b>{ratio}</b>
    </div>
  )
  observeIntersect(
    out,
    evt => {
      //      console.log(idx, 'intersect', Math.round(evt.intersectionRatio * 100))
      intersectStates['box' + idx] = Math.round(evt.intersectionRatio * 100)
      $s.intersectionRatio = evt.intersectionRatio
    },
    { detail: 0.01 },
  )
  return out
}

const MonitorIntersect = ({ value, name }) => {
  return (
    <div class="preview-box">
      <div style={value(h => `width:${h}px`)}></div>
      <b>{value(p => `${name}: ${p}%`)}</b>
    </div>
  )
}

addToBody(
  <div class="intersect-page">
    <div style="" class="owa IntesectOuter">
      <TestIntersect />
      <TestIntersect />
    </div>
    <div class="intersect-preview">
      <MonitorIntersect value={intersectStates.box1} name="1" />
      <MonitorIntersect value={intersectStates.box2} name="2" />
    </div>
  </div>,
)
