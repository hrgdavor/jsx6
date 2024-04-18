import { afterAll, expect, test } from 'bun:test'
import { $S, makeContext, makeSignalContext } from '../index.js'
import { observe, observeNow } from './observe.js'
import { domWithScope } from '../../jsx6/index.js'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

const refs = el => {
  const out = {}
  function setRef(el) {
    let p = el.getAttribute('p')
    if (p) out[p] = el
  }
  setRef(el)
  el.querySelectorAll('[p]').forEach(setRef)
  return out
}

const makeElem = html => {
  let out = document.createElement('DIV')
  out.innerHTML = html
  return out.firstChild
}

test('simple', () => {
  const ctx = makeContext()
  let div = makeElem(`<div></div>`)
  expect(div.tagName).toEqual('DIV')

  ctx.set(div, 1)
  expect(ctx.get(div)).toEqual(1)

  ctx.set(div, 3)
  expect(ctx.get(div)).toEqual(3)
})

test('simple signal', () => {
  const ctxs = makeSignalContext()

  let div = makeElem(`<div></div>`)
  expect(div.tagName).toEqual('DIV')

  ctxs.set(div, 1)

  let value
  observeNow(ctxs.getSignal(div), v => (value = v))

  expect(ctxs.get(div)).toEqual(1)
  expect(value).toEqual(1)

  ctxs.set(div, 3)
  expect(ctxs.get(div)).toEqual(3)
  expect(value).toEqual(3)
})

test('nested', () => {
  const ctx = makeContext()
  let div = makeElem(
    `<div p="firstLevel"><b p="first"></b><div p="secondLevel"><b p="second"></b></div></div>`,
  )
  const { firstLevel, first, secondLevel, second } = refs(div)

  expect(div.tagName).toEqual('DIV')
  expect(first.tagName).toEqual('B')

  ctx.set(div, 1)
  expect(ctx.get(div)).toEqual(1)
  expect(ctx.get(first)).toEqual(1)
  expect(ctx.get(second)).toEqual(1)

  ctx.set(div, 3)
  expect(ctx.get(div)).toEqual(3)
  expect(ctx.get(first)).toEqual(3)
  expect(ctx.get(second)).toEqual(3)

  ctx.set(secondLevel, 4)
  expect(ctx.get(div)).toEqual(3)
  expect(ctx.get(first)).toEqual(3)
  expect(ctx.get(secondLevel)).toEqual(4)
  expect(ctx.get(second)).toEqual(4)
})

test('nested signal', () => {
  const ctxs = makeSignalContext()

  let div = makeElem(
    `<div p="firstLevel"><b p="first"></b><div p="secondLevel"><b p="second"></b></div></div>`,
  )
  const { firstLevel, first, secondLevel, second } = refs(div)

  expect(div.tagName).toEqual('DIV')

  ctxs.set(div, 1)

  let value
  let value2
  observeNow(ctxs.getSignal(first), v => (value = v))

  expect(ctxs.get(div)).toEqual(1)
  expect(value).toEqual(1)
  expect(ctxs.get(first)).toEqual(1)
  expect(ctxs.get(second)).toEqual(1)

  ctxs.set(div, 3)
  expect(ctxs.get(div)).toEqual(3)
  expect(value).toEqual(3)
  expect(ctxs.get(first)).toEqual(3)
  expect(ctxs.get(second)).toEqual(3)

  ctxs.set(secondLevel, 4)
  observeNow(ctxs.getSignal(second), v => (value2 = v))

  expect(ctxs.get(div)).toEqual(3)
  expect(value).toEqual(3)
  expect(value2).toEqual(4)
  expect(ctxs.get(first)).toEqual(3)
  expect(ctxs.get(secondLevel)).toEqual(4)
  expect(ctxs.get(second)).toEqual(4)
})
