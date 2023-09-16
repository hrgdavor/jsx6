import test from 'ava'
// import { makeState, setAnimFunction } from './makeState.js'
import { addTranslations } from './core.js'
import { $T, addTranslationsAndNotify } from './trans.js'

import { $F, observeNow, signal } from '@jsx6/signal'
import { $State } from '@jsx6/signal-state'
const tryObserve = observeNow
const $S = $F
const makeState = v => (v !== null && typeof v === 'object' ? $State(v) : signal(v))

// call immediately to update state values without async (simpler testing)
// setAnimFunction(f => f())

test('T', t => {
  addTranslations({ name: 'Name' })
  const $s = makeState('name')
  const $translated = $T($s)
  console.log('after init', $translated())
  t.is('name', $s())
  t.is('Name', $translated())

  addTranslationsAndNotify({ name: 'Name2', first: 'First' })
  console.log('after trans', $translated())
  t.is('Name2', $translated())

  $s('first')
  t.is('First', $translated())
})
