import { VALUE } from './core.js'
import { mapObserver, observe } from './observe.js'

export const lazyShow = (filter, generator) => lazySwitch(v => (filter(v) ? 1 : 0), '', generator)
export const lazySwitchValue = (...generators) => lazySwitch(v => v, ...generators)
export const lazySwitch = (indexer, ...generators) => {
  if (generators.length === 1) generators = generators[0] // support string as keys
  return v => {
    let idx = indexer(v)
    let out = generators[idx]
    if (out !== undefined) {
      if (typeof out === 'function') generators[idx] = out = out(v)
      return out
    }
  }
}

export const Switch = ({ value, ...attr }, children) => {
  if (attr.if) {
    // take value observable from `if` attribute
    value = attr.if
    // make sure truthy stuff shows children as expected in js more broadly
    indexer = v => (v ? 0 : 1)
    children = [children, attr.else]
  } else {
    indexer = VALUE // passthrough, because we want to be using the original value
  }
  return mapObserver(value, lazySwitch(indexer, children))
}

/**
<Switch if={$s.count(c=>c>1)} else={t`no_data'}>
  <b>number: {$s.count}/1</b>
</Switch>
 

<Switch if={$s.count(c=>c>1)} else={<b class="no-data">{t`no_data`}</b>}>
  <b>number: {$s.count}/1</b>
</Switch>
*/
