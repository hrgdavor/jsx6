
import * as api from 'D:/wrk/jsx6/experiments/signal-directions/a-compat/index.js'
const $a = api.signal(0)
const $b = api.signal(1)
const $sum = api.$S(() => $a() + $b(), $a, $b)
const $filtered = api.$F(v => v * 2, $a)
const $s = api.$State({ x: 1 })
const $fromState = api.$S(() => $s.x() * 2, $s)
api.mergeValue($s, { x: 2 })
api.observeNow($sum, () => {})
api.observe($a, () => {})
globalThis.__size = [$sum(), $filtered(), $s.x(), $fromState(), api.isObservable($sum)]

const out = []
const A = api.toAlien($a)
const B = api.toAlien($b)
out.push(api.alien.computed(() => A() + B())())
api.dispose({})
globalThis.__size2 = out
