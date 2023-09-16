import { runInBatch } from './makeState.js'
import { addTranslations, runFunc, runFuncNoArg, t, TRANS } from './core.js'
// import { subscribeSymbol, triggerSymbol } from './observe.js'
// import { $S } from './combineState.js'

import { subscribeSymbol, triggerSymbol } from '@jsx6/signal'

import { $F, observeNow, signal } from '@jsx6/signal'
import { $State } from '@jsx6/signal-state'
const tryObserve = observeNow
const $S = $F
const makeState = v => (v !== null && typeof v === 'object' ? $State(v) : signal(v))

/**  @type {Array<Function>} */
const translationUpdaters = []

const $translationsSignal = () => {
  return TRANS
}

/**
 * @param {Function} callback
 */
export function observeTranslations(callback) {
  translationUpdaters.push(callback)
}

export function addTranslationsAndNotify(t) {
  addTranslations(t)
  fireTranslationsChange()
}

export function fireTranslationsChange() {
  runInBatch(translationDirtyRunner)
}

$translationsSignal[subscribeSymbol] = observeTranslations
$translationsSignal[triggerSymbol] = fireTranslationsChange

const translationDirtyRunner = () => translationUpdaters.forEach(runFuncNoArg)

export function T(code) {
  const out = () => t(code)
  out.subscribe = u => translationUpdaters.push(u)
  return out
}

export const $T = $code => $S(t, $code, $translationsSignal)
