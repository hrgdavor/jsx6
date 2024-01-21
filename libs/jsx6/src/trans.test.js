import { expect, test, afterAll } from 'bun:test'
import { addTranslations } from './core.js'
import { $T, addTranslationsAndNotify } from './trans.js'

import { signal } from '@jsx6/signal'

test('T', () => {
  addTranslations({ name: 'Name' })
  const $s = signal('name')
  const $translated = $T($s)
  expect('name').toEqual($s())
  expect('Name').toEqual($translated())

  addTranslationsAndNotify({ name: 'Name2', first: 'First' })
  expect('Name2').toEqual($translated())

  $s('first')
  expect('First').toEqual($translated())
})
