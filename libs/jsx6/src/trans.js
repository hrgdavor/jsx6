import { doSubscribeValue, runInBatch } from './makeState.js'
import { addTranslations, runFunc, runFuncNoArg, t, TRANS } from './core.js'
import { subscribeSymbol, triggerSymbol } from './observe.js'
import { $S } from './combineState.js'

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

  out.subscribe = u => doSubscribeValue(translationUpdaters, u, out)
  return out
}

export const $T = $code => $S(t, $code, $translationsSignal)
