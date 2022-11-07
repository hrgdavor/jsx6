import { doSubscribeValue, runInBatch } from './makeState.js'
import { t } from './core.js'

const translationUpdaters = []

export function refreshTranslations() {
  runInBatch(translationDirtyRunner)
}

const translationDirtyRunner = () => translationUpdaters.forEach(f => f())

export function T(code) {
  const out = () => t(code)

  out.subscribe = u => doSubscribeValue(translationUpdaters, u, out)
  return out
}
