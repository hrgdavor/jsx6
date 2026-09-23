//import dummy from '../happydom.js'
import { domWithScope, h } from '@jsx6/jsx6'
import { Loop } from './Loop.js'
import { signal } from '@jsx6/signal'
// import { expect, test } from 'bun:test'

test('simple', () => {
  const Item = ({ value }) => h('B', null, value.x)

  const loop = signal()
  let div = (
    <div>
      <Loop item={Item} p={loop} />
      test
    </div>
  )
  expect(div.innerHTML).toEqual('<jsx6-loop></jsx6-loop>test')
  loop().setValue([{ x: 11 }, { x: 12 }])
  expect(div.innerHTML).toEqual('<jsx6-loop><b>11</b><b>12</b></jsx6-loop>test')

  div = (
    <div>
      <Loop item={({ value }) => value.x} p={loop} />
      test
    </div>
  )
  expect(div.innerHTML).toEqual('<jsx6-loop></jsx6-loop>test')
  loop().setValue([{ x: 11 }, { x: 12 }])
  expect(div.innerHTML).toEqual('<jsx6-loop>1112</jsx6-loop>test')

  div = (
    <div>
      <Loop item={({ value }) => value} p={loop} primitive />
      test
    </div>
  )
  expect(div.innerHTML).toEqual('<jsx6-loop></jsx6-loop>test')
  loop().setValue([11, 12])
  expect(div.innerHTML).toEqual('<jsx6-loop>1112</jsx6-loop>test')
})

test('simple and tags', () => {
  const Item = ({ value }) => <b>{value.x}</b>

  const loop = signal()
  let div = (
    <div>
      <Loop item={Item} p={loop} />
      test
    </div>
  )
  expect(div.innerHTML).toEqual('<jsx6-loop></jsx6-loop>test')
  loop().setValue([{ x: 11 }, { x: 12 }])
  expect(div.innerHTML).toEqual('<jsx6-loop><b>11</b><b>12</b></jsx6-loop>test')
})
test('getValue remembers the value while detached and reads items once connected', () => {
  const Item = ({ value }) => <b>{value.x}</b>

  const loopSignal = signal()
  const div = (
    <div>
      <Loop item={Item} p={loopSignal} />
      test
    </div>
  )
  const loop = loopSignal()
  loop.setValue([{ x: 1 }, { x: 2 }])

  // Detached: `connected` is false, so the remembered raw value is returned.
  expect(loop.getValue()).toEqual([{ x: 1 }, { x: 2 }])

  document.body.appendChild(div)
  expect(loop.isConnected).toBe(true)
  // Connected: values come from the items themselves.
  expect(loop.getValue()).toEqual([{ x: 1 }, { x: 2 }])

  div.remove()
  expect(loop.isConnected).toBe(false)
  expect(loop.getValue()).toEqual([{ x: 1 }, { x: 2 }])
})

test('moveItem reorders and splice keeps sibling order', () => {
  const Item = ({ value }) => <b>{value.x}</b>

  const loopSignal = signal()
  const div = (
    <div>
      <Loop item={Item} p={loopSignal} />
      test
    </div>
  )
  const loop = loopSignal()
  loop.setValue([{ x: 1 }, { x: 2 }, { x: 3 }])
  expect(div.innerHTML).toEqual('<jsx6-loop><b>1</b><b>2</b><b>3</b></jsx6-loop>test')

  // insertBefore refers to the index in the original order (same contract as jsx6's Loop).
  loop.moveItem(0, 2)
  expect(div.innerHTML).toEqual('<jsx6-loop><b>2</b><b>1</b><b>3</b></jsx6-loop>test')

  // Remove from the middle: siblings keep their order.
  loop.splice(1, 1)
  expect(div.innerHTML).toEqual('<jsx6-loop><b>2</b><b>3</b></jsx6-loop>test')

  // The detached node is reused rather than rebuilt.
  loop.splice(2, 0, { x: 9 })
  expect(div.innerHTML).toEqual('<jsx6-loop><b>2</b><b>3</b><b>9</b></jsx6-loop>test')
})

// TODO test loop element reordering or removing without using setVisible
// without the setVisible we are also free to have textNodes and not just Elements(tags)
