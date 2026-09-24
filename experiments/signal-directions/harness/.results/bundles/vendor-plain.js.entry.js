
import { signal, computed, effect, effectScope, trigger, startBatch, endBatch, setActiveSub, getActiveSub } from 'D:/wrk/jsx6/experiments/signal-directions/vendor/alien-signals/index.mjs'
const a = signal(1)
const c = computed(() => a() * 2)
const stop = effect(() => { c(); return undefined })
startBatch(); a(2); endBatch()
trigger(() => a())
setActiveSub(getActiveSub())
effectScope(() => {})
stop()
globalThis.__alien = c()
