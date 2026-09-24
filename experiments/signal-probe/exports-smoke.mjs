/** Public surface smoke test: the new tracing exports exist, and the old API is untouched. */
import * as s from '../../libs/signal/index.js'

const { signal, signalTrace, traceSignals } = s

const tracing = [
  'traceSignal',
  'traceSignals',
  'signalTrace',
  'ensureTrace',
  'attachTrace',
  'captureSite',
  'captureFrom',
  'captureSiteSkipping',
  'describeName',
  'metaSymbol',
  'signalsTraced',
  'traceOptions',
]
const core = ['signal', 'staticSignal', 'asSignal', 'prepareSignal', 'observe', 'observeNow', 'subscribe']

const missingTracing = tracing.filter(k => typeof s[k] === 'undefined')
const missingCore = core.filter(k => typeof s[k] === 'undefined')
const computeds = ['$C', '$CE', '$S', '$F', '$State', 'batch', 'dispose', 'mergeValue'].filter(
  k => typeof s[k] === 'undefined',
)

console.log('missing tracing exports:', missingTracing.length ? missingTracing : 'none')
console.log('missing core exports   :', missingCore.length ? missingCore : 'none')
console.log('missing computed axis  :', computeds.length ? computeds : 'none')

traceSignals(true)
const $a = signal(1, 'a')
const meta = signalTrace($a)
console.log('a traced signal carries:', JSON.stringify({ kind: meta.kind, origin: meta.origin.text, listeners: meta.listeners.size }))
traceSignals(false)
