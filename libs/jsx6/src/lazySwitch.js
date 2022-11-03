import { isFunc, VALUE } from './core.js'
import { $R } from './combineState.js'
import { mapObserver } from './observe.js'

export const lazyShow = (value, generator) => lazySwitch(v => (v ? 1 : 0), value, '', generator)

export const lazySwitchValue = (value, ...generators) => lazySwitch(VALUE, value, ...generators)

export const lazySwitch = (indexer, value, ...generators) => {
  // support string as keys (generrators are in an object ) or array is used instead of varargs
  if (generators.length === 1) generators = generators[0]

  return $R(v => {
    const idx = indexer(v)
    let out = generators[idx]
    if (out !== undefined) {
      if (isFunc(out)) generators[idx] = out = out()
      return out
    }
  }, value)
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
