import { signal, computed, effect } from 'alien-signals'
const a = signal(1)
const c = computed(() => a() * 2)
const stop = effect(() => { c(); return undefined })
stop()
globalThis.__x = c()