import { $F, subscribeSymbol, triggerSymbol } from '@jsx6/signal'

import { runInBatch } from './makeState.js'
import { addTranslations, runFunc, runFuncNoArg, t, TRANS } from './core.js'

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

export const $T = $code => $F(t, $code, $translationsSignal)
