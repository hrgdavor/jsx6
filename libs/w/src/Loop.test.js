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
// TODO test loop element reordering or removing without using setVisible
// without the setVisible we are also free to have textNodes and not just Elements(tags)
