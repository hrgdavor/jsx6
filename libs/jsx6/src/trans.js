import { addDirty } from './dirty.js'
import { requireFunc, t } from './core.js'

const translationUpdaters = []

export function refreshTranslations() {
  addDirty(translationDirtyRunner)
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
