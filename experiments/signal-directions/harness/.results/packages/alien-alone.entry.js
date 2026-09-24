import * as alien from 'alien-signals'

const a = alien.signal(1)
const c = alien.computed(() => a() * 2)
const stop = alien.effect(() => { c(); return undefined })
alien.startBatch()
a(2)
alien.endBatch()
alien.trigger(() => a())
alien.effectScope(() => {})
stop()
globalThis.__alien = c()
