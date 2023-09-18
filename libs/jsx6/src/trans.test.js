import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { addTranslations } from './core.js'
import { $T, addTranslationsAndNotify } from './trans.js'

import { signal } from '@jsx6/signal'

// call immediately to update state values without async (simpler testing)
// setAnimFunction(f => f())

test('T', t => {
  addTranslations({ name: 'Name' })
  const $s = signal('name')
  const $translated = $T($s)
  assert.equal('name', $s())
  assert.equal('Name', $translated())

  addTranslationsAndNotify({ name: 'Name2', first: 'First' })
  assert.equal('Name2', $translated())

  $s('first')
  assert.equal('First', $translated())
})
