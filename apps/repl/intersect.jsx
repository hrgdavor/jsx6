import { observeIntersect } from '@jsx6/dom-observer'
import { $R, Jsx6, addToBody, makeState, provideErrTranslations } from '@jsx6/jsx6'

import './intersect.css'
import './main.css'

const percentStr = v => (v * 100).toFixed(0) + '%'
provideErrTranslations()
let seq = 1
let intersectStates = makeState({ box1: 0, box2: 0, box3: 0 })

const TestIntersect = ({}) => {
  const $s = makeState({ intersectionRatio: 0, isVisible: undefined })
  const idx = seq++
  // const ratioPercent = $s.intersectionRatio(percentStr)
  const ratioPercent = $R(percentStr, $s.intersectionRatio)
  const out = (
    <div class="TestIntersect">
      <b>{ratioPercent}</b>
      <div>{idx}</div>
      <b>{ratioPercent}</b>
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
      <div style={$R(h => `width:${h}px`, value)}></div>
      <b>{$R(p => `${name}: ${p}%`, value)}</b>
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
