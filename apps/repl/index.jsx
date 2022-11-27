// https://github.com/stacktracejs/stacktrace-gps
// https://github.com/stacktracejs/error-stack-parser
import {
  $R,
  Jsx6,
  Loop,
  T,
  addToBody,
  domWithScope,
  makeState,
  provideErrTranslations,
  runInBatch,
  tryObserve,
} from '@jsx6/jsx6'

import './main.css'
import IconNote from './src/icons/icon-note'

provideErrTranslations()

const num = makeState(0)
console.log('num() = ', num())
// tryObserve(num,v => console.log('num changed to ', v))
// console.log('num + 1 = ', num + 1)
// runInBatch(() => {
//   console.log('num + 1 = ', num + 1, 'before updating num=', num())
//   num().set(2)
//   console.log('num + 1 = ', num + 1, 'after updating num=', num())
// })

const objState = makeState({ x: 1 })
objState.set({ get: 'GETTTT' })
console.log('objState() = ', objState())
// console.log('objState.x + 1 = ', objState.x + 1)
// console.log('objState.x() + 1 = ', objState.x() + 1)
// console.log('objState() ', objState())
// console.log('objState().x ', objState().x)
// console.log('JSON.stringify(objState())', JSON.stringify(objState()))

function NotAComponent(attr) {
  const [state] = makeState({ count: 1, offset: 3 }, true)
  const out = (
    <b {...attr} name={name} onclick={evt => console.log('click', evt, state.count++, this)}>
      NotAComponent{state.count} / <i>{state(s => s.count + s.offset)}</i>
    </b>
  )
  return out
}

const NotAComponent2 = ({ text = 'NotAComponent2', TagName = 'b', ...attr }) => <TagName {...attr}>{text}</TagName>

class AComponent extends Jsx6 {
  tpl(h, $state, _state, self) {
    const value = this.$v
    return (
      <div>
        AComponent:<b onclick={e => this.el.loopComp?.removeItem(this)}>{value.name}</b>
      </div>
    )
  }
}

let ThePromise = new Promise((resolve, reject) => {
  setTimeout(() => resolve('promise_done'), 2000)
})

const scope = (window.APP = {})
// addToBody(
//   domWithScope(scope, h => (
//     <>
//       <Loop p="loop" item={({ value }) => value.name} />
//     </>
//   )),
// )

addToBody(
  domWithScope(scope, h => (
    <>
      <IconNote />
      <AComponent p="comp1" />
      Hello world.{T`test`} ...{ThePromise}
      <Loop p="loop" title={T`test`} item={AComponent} />
      <Loop
        p="loop2"
        item={({ $v }, c, _scope, loop) => (
          <div>
            {console.log('loop', loop)}
            TPL:<b onclick={e => scope.loop2.removeItem(_scope)}>{$R(name => name + '----', $v.name)}</b>
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
console.log('scope', scope)
scope.loop?.setValue([{ name: 'jozo' }, { name: 'mirko' }])
// scope.loop?.setValue([{ name: 'jozo' }])
scope.loop2?.setValue([{ name: 'jozo2' }, { name: 'mirko2' }])
// scope.loop2?.setValue([{ name: 'jozo' }])

console.log(scope)
console.log('scope.loop.getValue', scope.loop?.getValue())
console.log('scope.loop2.getValue', scope.loop2?.getValue())
