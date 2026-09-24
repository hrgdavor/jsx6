
import * as api from 'D:/wrk/jsx6/experiments/signal-directions/f-bridge-hybrid/index.js'
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
out.push(api.$C((a, b) => a + b, $a, $b)())
api.dispose({})
globalThis.__size2 = out
