import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { afterAll, expect, test } from 'bun:test'

GlobalRegistrator.register()
afterAll(() => GlobalRegistrator.unregister())

test('snap 1', async () => {
  var div = <div></div>
  expect(div.tagName).toEqual('DIV')
})
