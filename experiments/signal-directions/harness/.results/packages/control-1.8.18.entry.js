import * as api from 'D:/wrk/jsx6/experiments/signal-directions/baseline/signal/index.js'

const $a = api.signal(0)
const $b = api.signal(1)
const $sum = api.$S(() => $a() + $b(), $a, $b)
const $filtered = api.$F(v => v * 2, $a)
const $s = api.$State({ x: 1 })
const $fromState = api.$S(() => $s.x() * 2, $s)
api.mergeValue($s, { x: 2 })
api.observeNow($sum, () => {})
api.observe($a, () => {})
const out = [$sum(), $filtered(), $s.x(), $fromState()]


