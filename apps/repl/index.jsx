// https://github.com/stacktracejs/stacktrace-gps
// https://github.com/stacktracejs/error-stack-parser
import {
  Jsx6,
  addToBody,
  domWithScope,
  errTranslations,
  makeState,
  makeUpdater,
  setTranslations,
} from '@jsx6/jsx6'

import './main.css'

setTranslations(errTranslations)

function useState(value) {
  function get() {
    if (arguments.length) value = arguments[0]
    return value
  }
  get.toString = get
  return [
    get,
    function (v) {
      value = v
    },
  ]
}

const [$count, setCount] = useState(1)

console.log('count', $count())
setCount($count + 1)
console.log('count', $count())
$count($count + 1)
console.log('count', $count())

// const $state = makeState({ count: 1 })
const [state, $state, _state] = makeState({ count: 1, offset: 3 })

// console.log('state', $state, state)
// console.log('state.count+1', $state.count++)
// console.log('state.count+1', $state.count + 1)
console.log(state.count(), state.offset())
console.log(state.count + state.offset)

const objekt = { name: 'Jura voli JS' }
console.log(objekt + 1) // [object Object]1
objekt.toString = function () {
  return 100
}
console.log(objekt + 1) // 101

function NotAComponent(attr) {
  const state = makeState({ count: 1, offset: 3 })
  const out = (
    <b {...attr} name={name} onclick={evt => console.log('click', evt, state.count++, this)}>
      NotAComponent{state.count} / {state(s => state.count + state.offset)}
    </b>
  )
  console.log('out', out)
  return out
}

const NotAComponent2 = ({ text = 'NotAComponent2', TagName = 'b', ...attr }) => (
  <TagName {...attr}>{text}</TagName>
)

class AComponent extends Jsx6 {
  tpl(h, state, $state, self) {
    return <b>AComponent</b>
  }
}

const scope = {}
addToBody(
  domWithScope(scope, h => (
    <b>
      Hello world.
      <AComponent />
      <div p="jozo" />
      <NotAComponent style="border:solid 1px; display:block" />
      <NotAComponent2 style="border:solid 1px red; display: block" text="Bla" TagName="i" />
      <div style="width: 400px; height:400px; border: solid 1px" class="fxs"></div>
    </b>
  )),
)

console.log(scope)
