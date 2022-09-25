import { runInBatch } from './makeState.js'
import { requireFunc, t } from './core.js'
import { ERR_TRANS_UUPD_FUNC } from './errorCodes.js'

const translationUpdaters = []

export function refreshTranslations() {
  runInBatch(translationDirtyRunner)
}

const translationDirtyRunner = () => translationUpdaters.forEach(f => f())

function pushTranslationUpdater(func) {
  requireFunc(func, ERR_TRANS_UUPD_FUNC)
  translationUpdaters.push(func)
}

export function T(code) {
  const out = () => t(code)

  out.subscribe = pushTranslationUpdater
  return out
}
