// https://github.com/stacktracejs/stacktrace-gps
// https://github.com/stacktracejs/error-stack-parser
import {
  Jsx6,
  JsxW,
  Loop,
  T,
  addClass,
  addToBody,
  define,
  domWithScope,
  getScope,
  getValue,
  linkForm,
  provideErrTranslations,
  setValue,
} from '@jsx6/jsx6'
import { $S, $State } from '@jsx6/signal'

import IconNote from './icons/icon-note'
import './main.css'

provideErrTranslations()

const num = $S(0)
console.log('num() = ', num())
// tryObserve(num,v => console.log('num changed to ', v))
// console.log('num + 1 = ', num + 1)
// runInBatch(() => {
//   console.log('num + 1 = ', num + 1, 'before updating num=', num())
//   num().set(2)
//   console.log('num + 1 = ', num + 1, 'after updating num=', num())
// })

const objState = $State({ x: 1 })
objState.set({ get: 'GETTTT' })
console.log('objState() = ', objState())
// console.log('objState.x + 1 = ', objState.x + 1)
// console.log('objState.x() + 1 = ', objState.x() + 1)
// console.log('objState() ', objState())
// console.log('objState().x ', objState().x)
// console.log('JSON.stringify(objState())', JSON.stringify(objState()))

function NotAComponent(attr) {
  const state = $State({ count: 1, offset: 3 }, true)
  const out = (
    <b {...attr} name={name} onclick={evt => console.log('click', evt, state.count++, this)}>
      NotAComponent{state.count} / <i>{state(s => s.count + s.offset)}</i>
    </b>
  )
  return out
}

const NotAComponent2 = ({ text = 'NotAComponent2', TagName = 'b', ...attr }) => <TagName {...attr}>{text}</TagName>

class AComponent extends Jsx6 {
  tpl(attr = {}) {
    const { $v } = this
    return (
      <div {...attr}>
        AComponent:<b onclick={e => this.el.loopComp?.removeItem(this)}>{$v.name}</b>
      </div>
    )
  }
}

let ThePromise = new Promise((resolve, reject) => {
  setTimeout(() => resolve('promise_done'), 2000)
})

const scope = (window.APP = {})
// addToBody([<AComponent title="aaa" />])

// addToBody(
//   domWithScope(scope, h => (
//     <>
//       <Loop p="loop" item={({ value }) => value.name} />
//     </>
//   )),
// )
const $loopValue = $S([])
class UserEditor extends JsxW {
  static {
    define('myapp-admin-usereditor', this)
  }
  getValue() {
    return getValue(this.form)
  }
  setValue(v) {
    setValue(this.form, v)
  }
  tpl(attr) {
    super.tpl(attr)
    let out = (
      <>
        <h1>UserEditor3</h1>
        <label>name</label>
        <input p="form.name" />
      </>
    )
    return out
  }
}

function UserEditor3({ attr }, children) {
  let form = getScope()
  let out = (
    <div {...addClass(attr, 'UserEditor3')}>
      <h1>UserEditor3</h1>
      <label>name</label>
      <input p="name" />
    </div>
  )
  linkForm(out, form)
  return out
}

window.testState = $S(true)
addToBody(
  domWithScope(scope, h => (
    <>
      <JsxW>test1111</JsxW>
      {<UserEditor p="editor" class="test" />}
      <UserEditor3 p="editor3">test22222</UserEditor3>
      <div>array:{[<span>1</span>]}</div>
      <IconNote />
      <AComponent p="comp1" />
      Hello world.{T`test`} ...{ThePromise}
      (<Loop value={$loopValue} item={({ $v }) => <div>{$v}</div>} />)
      <Loop p="loop" title={T`test`} item={AComponent} x-if={window.testState} />
      <Loop
        p="loop2"
        item={({ $v }, c, _scope, loop) => (
          <div>
            {console.log('loop', loop)}
            TPL:<b onclick={e => scope.loop2.removeItem(_scope)}>{$S(name => name + '----', $v.name)}</b>
          </div>
        )}
      />
      <div p="jozo" />
      <NotAComponent style="border:solid 1px; display:block" />
      <NotAComponent2 style="border:solid 1px red; display: block" text="Bla" TagName="i" />
      <div style="width: 400px; height:400px; border: solid 1px" class="fxs"></div>
    </>
  )),
)
console.log('scope', scope, 'Loop', Loop)
scope.editor.setValue({ name: 'test value 1' })
scope.editor3.setValue({ name: 'test value 3' })
scope.loop?.setValue([{ name: 'jozo' }, { name: 'mirko' }])
scope.loop2?.setValue([{ name: 'jozo2' }, { name: 'mirko2' }])

console.log(scope)
console.log('scope.loop.getValue', scope.loop?.getValue())
console.log('scope.loop2.getValue', scope.loop2?.getValue())

setTimeout(() => $loopValue(['boink']), 1000)

//*/
