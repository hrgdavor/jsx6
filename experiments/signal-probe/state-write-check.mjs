/** Does a $State child write activate a traceSignal wrapper around that child? */
import { $State, signal, traceSignal } from '../../libs/signal/index.js'

const $s = $State({ n: 1 })
const $sn = traceSignal($s.n, { label: '$s.n', max: 6 })
console.log('read  :', $sn())
console.log('write same value ->', $s.n = 1)
console.log('write new value  ->', $s.n = 5)
console.log('read  :', $sn())
console.log('activations:', $sn.activations())

const $p = signal(0, 'p')
const $wp = traceSignal($p, { label: 'p', max: 6 })
console.log('\nplain signal write ->', $wp(7))
console.log('plain signal write (same) ->', $wp(7))
console.log('activations:', $wp.activations())
